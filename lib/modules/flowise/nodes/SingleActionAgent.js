const { LLMSingleActionAgent, AgentExecutor,AgentActionOutputParser,} = require("langchain/agents")
const { LLMChain } = require("langchain/chains")
const { additionalCallbacks } = require('flowise-components/dist/src/handler')

const { getBaseClasses } = require("flowise-components/dist/src/utils");

/**
 *
 */
module.exports = {
	nodeClass: class Node {
		constructor() {
			Object.assign(this, {
				label: "Custom Agent",
				name: "singleActionAgent",
				category: "Agents",
				type: "SingleActionAgent",
				icon: "fake.svg",
				baseClasses: [
					this.type,
					...getBaseClasses(LLMSingleActionAgent),
				],
				version: "1.0",
				description: "a single action agent using a LLMChain",
				inputs: [
					{
						label: "Allowed Tools",
						name: "tools",
						type: "Tool",
						list: true,
					},
					{
                        label: 'Model',
                        name: 'model',
                        type: 'BaseLanguageModel'
                    },
                    {
                        label: 'Prompt',
                        name: 'promptTemplate',
                        type: 'BasePromptTemplate'
                    },
					{
						label: "AI name",
						name: "aiName",
						type: "string",
                        optional: true,
						additionalParams: true,
					},
                    {
						label: "Filter Out Terms",
						name: "filterOut",
						type: "string",
                        optional: true,
						additionalParams: true,
					},
					{
						label: "Stop",
						name: "stop",
						type: "string",
						defaultValue: "\nObservation",
						optional: true,
						additionalParams: true,
					},
				],
			});
		}

		async init({inputs: { model, promptTemplate, stop = "\nObservation", aiName, filterOut, tools },}, input, options) {
            aiName=aiName || "AI"
            promptTemplate.format=(fx=>async function(input){
                const newInput={aiName, ...input}
                const intermediateSteps = input.intermediate_steps;
                const agentScratchpad = intermediateSteps.reduce((thoughts, { action, observation }) =>
                    thoughts + [action.log, `\nObservation: ${observation}`, "Thought:"].join("\n"),
                "");

                newInput["agent_scratchpad"] = agentScratchpad;

                const toolStrings = tools.map((tool) => `${tool.name}: ${tool.description}`) .join("\n");
                newInput["tools"] = toolStrings;

                const toolNames = tools.map((tool) => tool.name).join("\n");
                newInput["tool_names"] = toolNames;

                return await fx.call(this, newInput)
            })(promptTemplate.format);

            const chain=new LLMChain({
                llm:model, 
                prompt: promptTemplate
            })

			const agentExecutor = AgentExecutor.fromAgentAndTools({
				agent: new LLMSingleActionAgent({
					llmChain: chain,
					outputParser: new OutputParser({prefix:aiName, filterOut}),
					stop: [stop],
				}),
				tools,
			});
			return agentExecutor;
		}

		async run({ instance:agentExecutor}, input, options) {
            const callbacks = await additionalCallbacks(nodeData, options)
            const result = await agentExecutor.call({input}, callbacks);
            return result?.output
		}
	},
};

class OutputParser extends AgentActionOutputParser {
	constructor({ prefix,  filterOut}) {
		super(...arguments);
		this.ai_prefix = prefix;
        this.regexOut=new RegExp(filterOut.split(",").join("|"),'g')
	}

	async parse(text) {
		const regexOut = this.regexOut
		if (text.includes(this.ai_prefix + ":")) {
			const parts = text.split(this.ai_prefix + ":");
			const input = parts[parts.length - 1].trim().replace(regexOut, "");
			const finalAnswers = { output: input };
			// finalAnswers
			return { log: text, returnValues: finalAnswers };
		}
		const regex = /Action: (.*?)[\n]*Action Input: (.*)/;
		const match = text.match(regex);
		if (!match) {
			return {
				log: text,
				returnValues: { output: text.replace(regexOut, "") },
			};
		}
		return {
			tool: match[1].trim(),
			toolInput: match[2].trim().replace(/^"+|"+$/g, ""),
			log: text,
		};
	}
}
