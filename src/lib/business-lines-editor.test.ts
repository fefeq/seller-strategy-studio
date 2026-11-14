import { expect, it } from 'vitest';
import { editBusinessLine, syncPrimaryDiagnosis, type LineEditorPorts, type EditableLine } from './business-lines-editor';

const input = { model:'b2b', acv:10000, friction:'committee', stage:'early' };
const line: EditableLine = { ...input, id:'first', is_primary:true, name:null, position:0 };
function fixture(rows: EditableLine[] = [line]) {
  let current = [...rows];
  const calls: string[]=[];
  let failSession=false;
  let emptyWrite=false;
  const ports: LineEditorPorts = {
    read:async()=>current,
    write:async(id,value)=> {calls.push('write'); if(emptyWrite)return null; const saved={...line,...value,id:id??'created',is_primary:current.length===0 || id==='first'}; current=id?current.map(x=>x.id===id?saved:x):[...current,saved];return saved;},
    makePrimary:async(id)=> {calls.push('primary');current=current.map(x=>({...x,is_primary:x.id===id}));return id;},
    remove:async(id)=> {calls.push('remove');current=current.filter(x=>x.id!==id).map((x,i)=>({...x,is_primary:i===0}));return id;},
    saveDiagnosis:async(payload)=> {calls.push('session');expect(payload.input.acv).toBe(current.find(x=>x.is_primary)?.acv);if(failSession)throw new Error('Synthetic session failure');},
  };
  return {ports,calls,fail:()=>{failSession=true;},recover:()=>{failSession=false;},empty:()=>{emptyWrite=true;}};
}
it('CA-1 validates every declared model, positive ticket and name length before any write',async()=>{
  const f=fixture([]);
  for(const model of ['b2b','b2c','marketplace']) await expect(editBusinessLine(f.ports,['owner'],{kind:'save',input:{...input,model,acv:0},name:''})).rejects.toThrow();
  await expect(editBusinessLine(f.ports,['owner'],{kind:'save',input:{...input,stage:undefined},name:''})).rejects.toThrow();
  await expect(editBusinessLine(f.ports,['owner'],{kind:'save',input,name:'x'.repeat(201)})).rejects.toThrow();
  expect(f.calls).toEqual([]);
});
it('CA-1 fifth line is refused, existing line can be edited and members cannot write',async()=>{
  const rows=Array.from({length:4},(_,i)=>({...line,id:i===0?'first':String(i),is_primary:i===0}));
  const f=fixture(rows);
  await expect(editBusinessLine(f.ports,['owner'],{kind:'save',input,name:''})).rejects.toThrow();
  await expect(editBusinessLine(f.ports,['ae'],{kind:'save',id:'first',input,name:''})).rejects.toThrow();
  expect(f.calls).toEqual([]);
  expect((await editBusinessLine(f.ports,['sales_leader'],{kind:'save',id:'first',input,name:'  Synthetic  '})).diagnosisSynced).toBe(true);
  expect((await f.ports.read())[0]?.name).toBe('Synthetic');
});
it('CA-2 only Owner removes, last cannot be removed and successor is written to personal diagnosis',async()=>{
  const f=fixture([line,{...line,id:'second',is_primary:false,acv:20000}]);
  await expect(editBusinessLine(f.ports,['sales_leader'],{kind:'remove',id:'first'})).rejects.toThrow();
  expect(f.calls).toEqual([]);
  expect((await editBusinessLine(f.ports,['owner'],{kind:'remove',id:'first'})).diagnosisSynced).toBe(true);
  expect(f.calls).toEqual(['remove','session']);
  await expect(editBusinessLine(f.ports,['owner'],{kind:'remove',id:'second'})).rejects.toThrow();
});
it('CA-2 zero rows is a failure and never writes a personal success',async()=>{
  const f=fixture();f.empty();
  await expect(editBusinessLine(f.ports,['owner'],{kind:'save',id:'first',input,name:''})).rejects.toThrow();
  expect(f.calls).toEqual(['write']);
});
it('CA-2 primary RPC uses selected line then syncs its derived diagnosis',async()=>{
  const f=fixture([line,{...line,id:'second',is_primary:false,acv:20000}]);
  await editBusinessLine(f.ports,['sales_leader'],{kind:'primary',id:'second'});
  expect(f.calls).toEqual(['primary','session']);
});
it('CA-3 post-commit session failure retains line and retry only writes compatibility',async()=>{
  const f=fixture([]);f.fail();
  const result=await editBusinessLine(f.ports,['owner'],{kind:'save',input,name:''});
  expect(result.committed).toBe(true);expect(result.diagnosisSynced).toBe(false);
  expect((await f.ports.read())).toHaveLength(1);
  f.recover();expect((await syncPrimaryDiagnosis(f.ports)).diagnosisSynced).toBe(true);
  expect(f.calls).toEqual(['write','session','session']);
});
it('CA-3 missing primary cannot write or allow completion',async()=>{
  const f=fixture([{...line,is_primary:false}]);
  expect((await syncPrimaryDiagnosis(f.ports)).diagnosisSynced).toBe(false);
  expect(f.calls).toEqual([]);
});