import { ICommonObject, INodeData, INodeOutputsValue, INodeParams } from '../../../src';
import { Embeddings } from 'langchain/embeddings/base';
import { VectorStore } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';
import { createClient } from 'redis';
export declare abstract class RedisSearchBase {
    label: string;
    name: string;
    version: number;
    description: string;
    type: string;
    icon: string;
    category: string;
    baseClasses: string[];
    inputs: INodeParams[];
    credential: INodeParams;
    outputs: INodeOutputsValue[];
    redisClient: ReturnType<typeof createClient>;
    protected constructor();
    abstract constructVectorStore(embeddings: Embeddings, indexName: string, replaceIndex: boolean, docs: Document<Record<string, any>>[] | undefined): Promise<VectorStore>;
    init(nodeData: INodeData, _: string, options: ICommonObject, docs: Document<Record<string, any>>[] | undefined): Promise<any>;
}
