import type {Offer,ProductProfile} from "./domain.js";
import {HttpMcpConnector} from "./adapters/http-mcp.js";
export interface Connector{name:string;search(p:ProductProfile):Promise<Offer[]>;verify(o:Offer,p:ProductProfile):Promise<Offer>}
export class DisabledConnector implements Connector{constructor(public name:string){} async search(_:ProductProfile){return []} async verify(o:Offer,_:ProductProfile){return {...o,status:"UNVERIFIED" as const,reasons:[...o.reasons,"connector_not_configured"]}}}
const make=(name:string,key:string,searchTool="search_products",verifyTool="get_product"):Connector=>{const endpoint=process.env[key];return endpoint?new HttpMcpConnector(name,endpoint,process.env[key+"_SEARCH_TOOL"]||searchTool,process.env[key+"_VERIFY_TOOL"]||verifyTool):new DisabledConnector(name)};
export const connectors:Connector[]=[
 make("yandex-market","MARKET_MCP_URL"),
 make("ozon","OZON_MCP_URL"),
 make("avito","AVITO_MCP_URL"),
 make("aliexpress","ALIEXPRESS_MCP_URL"),
 make("taobao","TAOBAO_MCP_URL")
];