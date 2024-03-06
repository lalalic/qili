const fetch = require('node-fetch');
const { AIMessage, ChatMessage } = require("langchain/schema")
const { BaseChatModel } = require("langchain/chat_models/base")


class ChatBaiduWenxin extends BaseChatModel {
    static lc_name() {
        return 'ChatBaiduWenxin';
    }

    get callKeys() {
        return ['stop', 'signal', 'options'];
    }

    get lc_secrets() {
        return {
            baiduApiKey: 'BAIDU_API_KEY',
            baiduSecretKey: 'BAIDU_SECRET_KEY',
        };
    }

    get lc_aliases() {
        return undefined;
    }

    constructor(fields = {}) {
        super(fields);
        this.lc_serializable = true;
        this.baiduApiKey = fields.baiduApiKey || process.env.BAIDU_API_KEY;
        if (!this.baiduApiKey) {
            throw new Error('Baidu API key not found');
        }

        this.baiduSecretKey = fields.baiduSecretKey || process.env.BAIDU_SECRET_KEY;
        if (!this.baiduSecretKey) {
            throw new Error('Baidu Secret key not found');
        }

        this.streaming = fields.streaming || this.streaming;
        this.prefixMessages = fields.prefixMessages || this.prefixMessages;
        this.userId = fields.userId || this.userId;
        this.temperature = fields.temperature || this.temperature;
        this.topP = fields.topP || this.topP;
        this.penaltyScore = fields.penaltyScore || this.penaltyScore;

        this.modelName = fields.modelName || this.modelName;

        if (this.modelName === 'ERNIE-Bot') {
            this.apiUrl =
                'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions';
        } else if (this.modelName === 'ERNIE-Bot-turbo') {
            this.apiUrl =
                'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant';
        } else if (this.modelName === 'ERNIE-Bot-4') {
            this.apiUrl =
                'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro';
        } else {
            throw new Error(`Invalid model name: ${this.modelName}`);
        }
    }

    async getAccessToken(options) { 
        const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.baiduApiKey}&client_secret=${this.baiduSecretKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            signal: options?.signal,
        });
        if (!response.ok) {
            const text = await response.text();
            const error = new Error(
                `Baidu get access token failed with status code ${response.status}, response: ${text}`
            );
            error.response = response;
            throw error;
        }
        const json = await response.json();
        return json.access_token;
    }

    invocationParams() {
        return {
            stream: this.streaming,
            user_id: this.userId,
            temperature: this.temperature,
            top_p: this.topP,
            penalty_score: this.penaltyScore,
        };
    }

    identifyingParams() {
        return {
            model_name: this.modelName,
            ...this.invocationParams(),
        };
    }

    async _generate(messages, options, runManager) {
        const tokenUsage = {};

        const params = this.invocationParams();

        const systemMessage = messages.find(
            (message) => message._getType() === 'system'
        );
        if (systemMessage) {
            messages = messages.filter((message) => message !== systemMessage);
            params.system = systemMessage.text;
        }
        const messagesMapped = messages.map((message) => ({
            role: this.messageToWenxinRole(message),
            content: message.text,
        }));

        const data = params.stream
            ? await new Promise((resolve, reject) => {
                let response;
                let rejected = false;
                let resolved = false;
                this.completionWithRetry(
                    {
                        ...params,
                        messages: messagesMapped,
                    },
                    true,
                    options?.signal,
                    (event) => {
                        const data = JSON.parse(event.data);

                        if (data?.error_code) {
                            if (rejected) {
                                return;
                            }
                            rejected = true;
                            reject(new Error(data?.error_msg));
                            return;
                        }

                        const message = data;
                        if (!response) {
                            response = {
                                id: message.id,
                                object: message.object,
                                created: message.created,
                                result: message.result,
                                need_clear_history: message.need_clear_history,
                                usage: message.usage,
                            };
                        } else {
                            response.result += message.result;
                            response.created = message.created;
                            response.need_clear_history = message.need_clear_history;
                            response.usage = message.usage;
                        }

                        void runManager?.handleLLMNewToken(message.result ?? '');

                        if (message.is_end) {
                            if (resolved || rejected) {
                                return;
                            }
                            resolved = true;
                            resolve(response);
                        }
                    }
                ).catch((error) => {
                    if (!rejected) {
                        rejected = true;
                        reject(error);
                    }
                });
            })
            : await this.completionWithRetry(
                {
                    ...params,
                    messages: messagesMapped,
                },
                false,
                options?.signal
            ).then((data) => {
                if (data?.error_code) {
                    throw new Error(data?.error_msg);
                }
                return data;
            });

        const { completion_tokens, prompt_tokens, total_tokens } = data.usage ?? {};

        if (completion_tokens) {
            tokenUsage.completionTokens = (tokenUsage.completionTokens ?? 0) + completion_tokens;
        }

        if (prompt_tokens) {
            tokenUsage.promptTokens = (tokenUsage.promptTokens ?? 0) + prompt_tokens;
        }

        if (total_tokens) {
            tokenUsage.totalTokens = (tokenUsage.totalTokens ?? 0) + total_tokens;
        }

        const generations = [];
        const text = data.result ?? '';
        generations.push({
            text,
            message: new AIMessage(text),
        });
        return {
            generations,
            llmOutput: { tokenUsage },
        };
    }

    async completionWithRetry(request, stream, signal, onmessage) {
        if (!this.accessToken) {
            this.accessToken = await this.getAccessToken();
        }

        const makeCompletionRequest = async () => {
            const url = `${this.apiUrl}?access_token=${this.accessToken}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                signal,
            });

            if (!stream) {
                return response.json();
            } else {
                if (
                    !response.headers
                        .get('content-type')
                        ?.startsWith('text/event-stream')
                ) {
                    onmessage?.(
                        new MessageEvent('message', {
                            data: await response.text(),
                        })
                    );
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let data = '';

                let continueReading = true;
                while (continueReading) {
                    const { done, value } = await reader.read();
                    if (done) {
                        continueReading = false;
                        break;
                    }
                    data += decoder.decode(value);

                    let continueProcessing = true;
                    while (continueProcessing) {
                        const newlineIndex = data.indexOf('\n');
                        if (newlineIndex === -1) {
                            continueProcessing = false;
                            break;
                        }
                        const line = data.slice(0, newlineIndex);
                        data = data.slice(newlineIndex + 1);

                        if (line.startsWith('data:')) {
                            const event = new MessageEvent('message', {
                                data: line.slice('data:'.length).trim(),
                            });
                            onmessage?.(event);
                        }
                    }
                }
            }
        };
        return this.caller.call(makeCompletionRequest);
    }

    _llmType() {
        return 'baiduwenxin';
    }

    _combineLLMOutput() {
        return [];
    }

    messageToWenxinRole(message) {
        const type = message._getType();
        switch (type) {
            case 'ai':
                return 'assistant';
            case 'human':
                return 'user';
            case 'system':
                throw new Error('System messages should not be here');
            case 'function':
                throw new Error('Function messages not supported');
            case 'generic': {
                if (!ChatMessage.isInstance(message))
                    throw new Error('Invalid generic chat message');
                return this.extractGenericMessageCustomRole(message);
            }
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    }

    extractGenericMessageCustomRole(message) {
        if (message.role !== 'assistant' && message.role !== 'user') {
            console.warn(`Unknown message role: ${message.role}`);
        }

        return message.role;
    }
}

module.exports = { ChatBaiduWenxin };
