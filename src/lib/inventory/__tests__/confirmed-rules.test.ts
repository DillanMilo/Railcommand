import assert from "node:assert/strict";
import { operationalCarrying, inventoryDeviceDraft, operationalInventory, annualReviewText, inventoryRuleForms, type InventoryCost, type InventoryLot, type InventoryPolicy, type InventorySnapshot, type InventoryDraft } from "@railcommand/domain";
describe("Wendy confirmed contract rules", () => {
 const policy={annual_rate:0.05,threshold_amount:50000,currency:"USD",version:1} as InventoryPolicy;
 const components=Object.fromEntries(["log","mill","trucking","treating","drying","creosote","rail_car","install_labour","inspection","carrying_cost","disposal"].map((k,i)=>[k,{amount:i<7?68000/8:null,status:"actual",source:"verified opening lot total"}]));
 components.log.amount=17000;
 const cost={components} as InventoryCost;
 const lot={balance:1000,opening_quantity:1000,received_at:"2026-01-01"} as InventoryLot;
 it("calculates ACT/365 annual capital from valued remaining stock with no storage duplication",()=>{
  assert.deepEqual(operationalCarrying(lot,cost,policy,"2026-03-02T23:59:59Z"),{state:"annual_component_only",annual:558.9,days:60,inventoryValue:68000,rate:0.05});
  assert.equal(operationalCarrying({...lot,balance:500},cost,policy,"2026-03-02").annual,279.45);
  assert.equal(operationalCarrying(lot,{...cost,annual_rate_override:0.1},policy,"2026-03-02").annual,1117.81);
  for(const l of [{...lot,received_at:null},{...lot,opening_quantity:undefined},{...lot,received_at:"2027-01-01"}])assert.equal(operationalCarrying(l,cost,policy,"2026-03-02").annual,null);
  assert.equal(operationalCarrying(lot,undefined,policy,"2026-03-02").annual,null);
 });
 it("retains private original identities and versions but no new contract or policy values on device",()=>{
  for(const action of ["policy","contract","baseline","supply_chain_assign"] as const){
   const command={action,expectedVersion:7,annualRate:0.05,contractId:"private-contract",amount:30000,source:"Private reconciled evidence"};
   const d={operationId:"original",command:{action:"submit",reason:"field draft"},pending:{operationId:"original-private",command},phase:"unknown"} as unknown as InventoryDraft;
   assert.deepEqual(inventoryDeviceDraft(d).pending,{operationId:"original-private",command:{action,receiptOnly:true,expectedVersion:7}});
  }
  const s={projectId:"p",finance:{policy},events:[{id:"private",action:"baseline",reason:"USD 30000"},{id:"sc",action:"supply_chain",reason:"USD 60000"}]} as unknown as InventorySnapshot;
  const safe=JSON.stringify(operationalInventory(s));assert.doesNotMatch(safe,/30000|60000|annual_rate|baseline/);assert.match(safe,/supply_chain/);
 });
 it("uses the same explicit settings and hold wording on web and native",()=>{
  assert.match(annualReviewText(undefined),/reconciliation required/);
  assert.match(annualReviewText({state:"already_funded"}),/zero incremental/);
  assert.match(annualReviewText({state:"complete",forecast:60000,currency:"USD",requiresSupplyChain:true,eligibleSupplyChain:false}),/Hold: assign/);
  assert.match(annualReviewText({state:"complete",forecast:60000,currency:"USD",requiresSupplyChain:true,eligibleSupplyChain:true,likelySplit:true}),/Likely split purchases/);
  assert.deepEqual(inventoryRuleForms({policy} as never).map(f=>f.action),["policy","contract","baseline","supply_chain_assign"]);
 });
});
