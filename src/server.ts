import Fastify from "fastify"; import cors from "@fastify/cors"; import {z} from "zod"; import {searchVerified} from "./service.js";
const app=Fastify({logger:true}); await app.register(cors,{origin:true});
const schema=z.object({brand:z.string(),model:z.string(),year:z.coerce.number().optional(),cpu:z.string().optional(),ramGb:z.coerce.number().optional(),ssdGb:z.coerce.number().optional(),gpu:z.string().optional()});
app.get("/health",async()=>({ok:true,name:"Marketplace Scout",version:"0.1.0"}));
app.get("/api/search",async(req,reply)=>{const p=schema.safeParse(req.query);if(!p.success)return reply.code(400).send({error:p.error.flatten()}); return {profile:p.data,offers:await searchVerified(p.data)}});
app.listen({port:Number(process.env.PORT||8787),host:"0.0.0.0"});