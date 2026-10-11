import {useState} from 'react';
import {money} from '../../../data/utilityData.js';
import {Panel,SectionTitle} from './UtilityUI.jsx';
export default function DemoPayment({item,paid,onPay}){
 const [confirm,setConfirm]=useState(false);
 return <Panel className="u3-payment"><div className="u3-head-row"><SectionTitle title="Payment center" detail="View your example bill and practice the payment flow"/><span className={`u3-paystatus ${paid?'paid':''}`}>{paid?'Demo paid':'Demo bill due'}</span></div>
  <div className="u3-pay-summary"><div><span>Current sample balance</span><strong>{money(item.monthly)}</strong></div><div><span>Example due date</span><strong>{item.due}</strong></div><div><span>Provider connection</span><strong>Not linked</strong></div></div>
  {paid?<div className="u3-notice-green">Marked paid in this browser's demo. No funds were transferred or provider records changed.</div>:<button className="u3-primary" type="button" onClick={()=>setConfirm(true)}>Pay sample bill</button>}
  {confirm&&!paid&&<div className="u3-payment-modal"><div className="u3-payment-inner"><strong>Confirm demonstration payment</strong><p>You are about to mark a fictional {item.label.toLowerCase()} bill of {money(item.monthly)} as paid. This is not a real payment. No card details are collected.</p><div className="u3-payment-buttons"><button type="button" className="u3-outline" onClick={()=>setConfirm(false)}>Cancel</button><button type="button" className="u3-primary" onClick={()=>{onPay(item.id);setConfirm(false)}}>Mark demo bill paid</button></div></div></div>}
  <p className="u3-footnote">Real payment processing will require a supported provider connection and a secure, PCI-compliant payment flow. Never enter bank or card details in this demo.</p>
 </Panel>;
}
