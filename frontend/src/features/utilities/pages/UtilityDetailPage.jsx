import {useState} from 'react';
import {utilityById} from '../../../data/utilityData.js';
import {PageHead, DemoBadge, ItemOverview, TrendPanel, BillBreakdown, ActionLink, SectionTitle, ServiceTile} from '../components/UtilityUI.jsx';
import ElectricityPage from './ElectricityPage.jsx';
import WaterPage from './WaterPage.jsx';
import GasPage from './GasPage.jsx';
import InternetServicePage from '../../management/InternetServicePage.jsx';
import UsageHistoryPanel from '../../management/UsageHistoryPanel.jsx';
import WasteReminders from '../../management/WasteReminders.jsx';
import WastePage from './WastePage.jsx';
import DemoPayment from '../components/DemoPayment.jsx';
import {useHouseholdProfile,getProfiledUtility} from '../../../state/householdProfile.js';
const detailSections={electricity:ElectricityPage,water:WaterPage,gas:GasPage,internet:InternetServicePage,waste:WastePage};
export default function UtilityDetailPage({utilityId,onNavigate,paidBills={},onDemoPay=()=>{}}) {
  const profile=useHouseholdProfile();
  const item=getProfiledUtility(profile,utilityId);
  const [metric,setMetric]=useState('usage');
  if (!item) return <main className="u2-page"><p>Utility not found.</p></main>;
  const Feature=detailSections[item.id];
  return <main className="u2-page">
    <PageHead crumb={`UTILITIES / ${item.label.toUpperCase()}`} title={item.label} subtitle={item.summary} action={<ActionLink onClick={()=>onNavigate('utilities')}>All utilities</ActionLink>}/>
    <DemoBadge/>
    <ItemOverview item={item}/>
    <div className="u2-section-gap"><SectionTitle title={`${item.label} overview`} detail="Explore your service, billing, and planning tools"/></div>
    <div className="u2-two-col"><TrendPanel item={item} metric={metric} setMetric={setMetric}/><BillBreakdown item={item}/></div>
    <div className="u2-section-gap"><SectionTitle title="Plan ahead" detail="Try the interactive scenarios below; these do not affect any real account"/></div>
    <Feature item={item} onNavigate={onNavigate}/>
    <UsageHistoryPanel key={`${item.id}-${profile.homeName}`} item={item}/>
    {item.id==='waste'&&<WasteReminders/>}
    <div className="u2-section-gap"><DemoPayment item={item} paid={Boolean(paidBills[item.id])} onPay={onDemoPay}/></div>
    <div className="u2-section-gap"><ServiceTile item={item}/></div>
  </main>;
}
