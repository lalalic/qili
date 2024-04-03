const fetch = require('node-fetch');
const { BaseChatModel } = require("langchain/chat_models/base")
const { AIMessage, ChatMessage } = require("langchain/schema")

/**
it doesn't support adjacent message from same role
 */
class ChatAlibabaTongyi extends BaseChatModel {
    static lc_name() {
        return 'ChatAlibabaTongyi';
    }

    get callKeys() {
        return ['stop', 'signal', 'options'];
    }

    get lc_secrets() {
        return {
            alibabaApiKey: 'ALIBABA_API_KEY',
        };
    }

    get lc_aliases() {
        return undefined;
    }

    get isMutimodal(){
        return this.modelName.indexOf('-vl')!=-1
    }

    constructor(fields = {}) {
        super(fields)
        this.alibabaApiKey = fields?.alibabaApiKey || process.env.ALIBABA_API_KEY;
        if (!this.alibabaApiKey) {
            console.warn('Ali API key not found');
        }

        this.lc_serializable = true;
        this.streaming = fields.streaming || false;
        this.prefixMessages = fields.prefixMessages || [];
        this.temperature = fields.temperature;
        this.topP = fields.topP;
        this.topK = fields.topK;
        this.seed = fields.seed;
        this.maxTokens = fields.maxTokens;
        this.repetitionPenalty = fields.repetitionPenalty;
        this.modelName = fields.modelName || 'qwen-turbo';
        this.apiUrl =`https://dashscope.aliyuncs.com/api/v1/services/aigc/${this.isMutimodal ? 'multimodal' : 'text'}-generation/generation`
    }



    invocationParams() {
        const parameters = {
            stream: this.streaming,
            temperature: this.temperature,
            top_p: this.topP,
            top_k: this.topK,
            seed: this.seed,
            max_tokens: this.maxTokens,
            result_format: 'message',
            enable_search: this.enableSearch,
        };

        if (this.streaming) {
            parameters.incremental_output = true;
        } else {
            parameters.repetition_penalty = this.repetitionPenalty;
        }

        return parameters;
    }

    identifyingParams() {
        return {
            model: this.modelName,
            ...this.invocationParams(),
        };
    }

    _mergeAdjacentSameRoleContent(messages){
        return messages.reduce((merged,message,i)=>{
            const last=merged[i-1]
            if(!last || last.role!=message.role){
                merged.push(message)
            }else{
                if(typeof(last.content)=="string"){
                    last.content=`${last.content}\n${message.content}`
                }else if(Array.isArray(last.content)){
                    last.content=[...last.content, ...message.content]
                }else {
                    merged.push(message)
                }
            }
            return merged
        },[])
    }

    async _generate(messages, options, runManager) {
        const parameters = this.invocationParams();

        const messagesMapped = this._mergeAdjacentSameRoleContent(
            messages.map((message) => ({
                role: this.messageToTongyiRole(message),
                content: message.content,
            }))
        )

        const data = parameters.stream
            ? await new Promise((resolve, reject) => {
                let response;
                let rejected = false;
                let resolved = false;
                this.completionWithRetry(
                    {
                        model: this.modelName,
                        parameters,
                        input: {
                            messages: messagesMapped,
                        },
                    },
                    true,
                    options?.signal,
                    (event) => {
                        const data = JSON.parse(event.data);
                        if (data?.code) {
                            if (rejected) {
                                return;
                            }
                            rejected = true;
                            reject(new Error(data?.message));
                            return;
                        }

                        const { text, finish_reason } = data.output;

                        if (!response) {
                            response = data;
                        } else {
                            response.output.text += text;
                            response.output.finish_reason = finish_reason;
                            response.usage = data.usage;
                        }

                        void runManager?.handleLLMNewToken(text ?? '');
                        if (finish_reason && finish_reason !== 'null') {
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
                    model: this.modelName,
                    parameters,
                    input: {
                        messages: messagesMapped,
                    },
                },
                false,
                options?.signal
            ).then((data) => {
                if (data?.code) {
                    throw new Error(data?.message);
                }

                return data;
            });

        const {
            input_tokens = 0,
            output_tokens = 0,
            image_tokens = 0,
            total_tokens = input_tokens+output_tokens+image_tokens,
        } = data.usage;

        let text = data.output.choices[0].message.content;
        if(this.isMutimodal){
            text=text[0].text
        }

        return {
            generations: [
                {
                    text,
                    message: new AIMessage(text),
                },
            ],
            llmOutput: {
                tokenUsage: {
                    prompt_tokens: input_tokens,
                    completion_tokens: output_tokens,
                    total_tokens: total_tokens,
                },
            },
        };
    }

    async completionWithRetry(request, stream, signal, onmessage) {
        const makeCompletionRequest = async () => {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    ...(stream ? { Accept: 'text/event-stream' } : {}),
                    Authorization: `Bearer ${this.alibabaApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                signal,
            });

            if (!stream) {
                return response.json();
            }

            if (response.body) {
                if (
                    !response.headers.get('content-type')?.startsWith('text/event-stream')
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
        return 'alibaba_tongyi';
    }

    _combineLLMOutput() {
        return [];
    }

    extractGenericMessageCustomRole(message) {
        if (!['system', 'assistant', 'user'].includes(message.role)) {
            console.warn(`Unknown message role: ${message.role}`);
        }

        return message.role;
    }

    messageToTongyiRole(message) {
        const type = message._getType();
        switch (type) {
            case 'ai':
                return 'assistant';
            case 'human':
                return 'user';
            case 'system':
                return 'system';
            case 'function':
                throw new Error('Function messages not supported');
            case 'generic': {
                if (!this.ChatMessage.isInstance(message))
                    throw new Error('Invalid generic chat message');
                return this.extractGenericMessageCustomRole(message);
            }
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    }
}

module.exports = { ChatAlibabaTongyi };