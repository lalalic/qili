Hacks
===
* CallbackManager: it's critical to make a running nodes hirarchy, which is based on callbackManager's runId. We create a monitor with a root run id, that will be passed down to any runnable nodes. Any callbackManager should get parent run Id for this monitor. how to implement this : 
    * QiliMonitor extends Handlers.LLMonitor: make it compatible
    * [Key]: Each callbackManager in langChain is instantiated from CallbackManager.configure
        * make root run id from monitor as parent run id of any new callbackManager
* Chatflow Graph
    * build source-to-target and target-to-source graph
* Extend all nodes with Metadata
* Extend runnable nodes with pre/post action, evaluators
* Extend tools

node definition
===
* label, name, description, version, icon, 
* type  
* category [Tools, Evaluators, Chains, ]
* baseClasses=[this.type, ...]
* inputs
    * label, name, description, 
    * optional, additionalParams
    * type [string, boolean, number, ... <BaseClassName: BaseChatModel, VectorStore, Tool...>]
        * string
            * rows
        * file
            * fileType: like .csv, .txt
        * credential
            * credentialNames: ['airtableApi']
        * list
            * {label, name}
    * loadMethod
    * optional
* outputs
    * 