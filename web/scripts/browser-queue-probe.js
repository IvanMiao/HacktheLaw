/* Mock-only queued-context regression. Evaluate AFTER browser-realtime-probe.js.
 * No provider requests. It holds first intent until second utterance is queued.
 * Expected requests[].hypothetical: [false,true], then reset restores baseline. */
(() => {
 window.queueProbe={mockOnly:true,requests:[]};
 window.WebSocket=class {static OPEN=1;readyState=1;bufferedAmount=0;constructor(){window.probeSocket=this;setTimeout(()=>this.onmessage?.({data:'{"type":"ready"}'}),100);}send(){}close(){this.readyState=3;}};
 window.fetch=async(url,options)=>{if(url==='/api/intent'){const input=JSON.parse(options.body);queueProbe.requests.push({text:input.text,hypothetical:input.context.hypothetical});if(queueProbe.requests.length===1){await new Promise(resolve=>{window.releaseFirstMock=resolve;});return Response.json({intent:{action:'preview_scenario',target:'q-email',value:true,sourceIds:['email']}});}return Response.json({intent:{action:'reset_scenario',target:null,value:null,sourceIds:[]}});}return Response.json({configured:true});};
 window.runQueueProbe=()=>{playSyntheticSequence();setTimeout(()=>probeSocket.onmessage({data:JSON.stringify({type:'delta',text:'What if the email acknowledges the debt?'})}),1200);setTimeout(()=>probeSocket.onmessage({data:JSON.stringify({type:'delta',text:'Reset the scenario'})}),10000);setTimeout(()=>releaseFirstMock(),14500);};
 return 'Mock-only regression installed; no provider calls';
})();
