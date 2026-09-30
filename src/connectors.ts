import type {Offer,ProductProfile} from "./domain.js";
export interface Connector{name:string;search(p:ProductProfile):Promise<Offer[]>;verify(o:Offer,p:ProductProfile):Promise<Offer>}
// Adapters intentionally isolate third-party MCP/browser implementations.
// Never treat search-engine snippets as verified prices.
export class DisabledConnector implements Connector{constructor(public name:string){} async search(_:ProductProfile){return []} async verify(o:Offer,_:ProductProfile){return {...o,status:"UNVERIFIED" as const,reasons:[...o.reasons,"connector_not_configured"]}}}
export const connectors:Connector[]=[new DisabledConnector("yandex-market"),new DisabledConnector("ozon"),new DisabledConnector("avito"),new DisabledConnector("aliexpress"),new DisabledConnector("taobao")];