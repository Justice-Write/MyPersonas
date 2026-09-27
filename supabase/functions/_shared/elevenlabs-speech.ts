import {voiceId} from './elevenlabs.ts';
export function speechRequest(body:Record<string,any>){
 if(typeof body.text!=='string'||!body.text.trim()||Array.from(body.text).length>2000||new TextEncoder().encode(body.text).length>8000)throw new Error('Enter a script of up to 2,000 characters.');
 const settings:Record<string,number|boolean>={};
 for(const [name,min,max] of [['stability',0,1],['similarity_boost',0,1],['style',0,1],['speed',.7,1.2]] as const){const value=body.settings?.[name];if(value!==undefined){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error('Check the voice settings.');settings[name]=value;}}
 if(body.settings?.use_speaker_boost!==undefined){if(typeof body.settings.use_speaker_boost!=='boolean')throw new Error('Check speaker boost.');settings.use_speaker_boost=body.settings.use_speaker_boost;}
 return {text:body.text,voice_id:voiceId(body.voiceId),model_id:voiceId(body.modelId),voice_settings:settings};
}
export function speechQuote(request:ReturnType<typeof speechRequest>,models:any[]){
 const model=models.find(m=>m.model_id===request.model_id&&m.can_do_text_to_speech);
 if(!model)throw new Error('Choose an available speech model.');
 if(request.voice_settings.style!==undefined&&!model.can_use_style)throw new Error('This model does not support the style setting.');
 if(request.voice_settings.use_speaker_boost!==undefined&&!model.can_use_speaker_boost)throw new Error('This model does not support speaker boost.');
 const rate=model.model_rates?.character_cost_multiplier,discount=model.model_rates?.cost_discount_multiplier??1;
 if(typeof rate!=='number'||typeof discount!=='number'||!Number.isFinite(rate*discount)||rate<=0||discount<=0||rate*discount>100)throw new Error('The provider has not supplied a usable credit estimate for this model.');
 return Math.ceil(Array.from(request.text).length*rate*discount);
}
export async function speechBytes(response:Response,max=4194304){
 if(!response.body)throw new Error('The audio response was empty.');const reader=response.body.getReader(),parts:Uint8Array[]=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max)throw new Error('The audio exceeds this workspace limit.');parts.push(value);}}finally{await reader.cancel();}
 if(!total)throw new Error('The audio response was empty.');const output=new Uint8Array(total);let pos=0;for(const p of parts){output.set(p,pos);pos+=p.length;}return output;
}
