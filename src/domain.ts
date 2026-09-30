export type Status="VERIFIED"|"UNVERIFIED"|"MISMATCH"|"STALE";
export type ProductProfile={brand:string;model:string;year?:number;cpu?:string;ramGb?:number;ssdGb?:number;gpu?:string};
export type Offer={marketplace:string;title:string;url:string;priceRub:number|null;seller?:string;sku?:string;specs:Partial<ProductProfile>;status:Status;verifiedAt?:string;reasons:string[]};
const norm=(v?:string)=>v?.toLowerCase().replace(/[^a-zа-я0-9]+/gi," ").trim()??"";
export function match(p:ProductProfile,o:Offer){const reasons:string[]=[]; const eq=(k:keyof ProductProfile)=>{if(p[k]!=null&&o.specs[k]!=null&&norm(String(p[k]))!==norm(String(o.specs[k]))) reasons.push(String(k))}; ["brand","model","year","cpu","ramGb","ssdGb","gpu"].forEach(k=>eq(k as keyof ProductProfile)); return {ok:reasons.length===0,reasons};}
export function totalPrice(o:Offer,shipping=0,duty=0){return o.priceRub==null?null:o.priceRub+shipping+duty;}