import {useSection} from '../../../app/navigation.js';
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
  const [section]=useSection(utilityId,['usage','costs','peak','battery','breaker','solar'],'usage');
  const equipmentOnly=utilityId==='electricity'&&['battery','breaker','solar'].includes(section);
  if (!item) return <main className="u2-page"><p>Utility not found.</p></main>;
  const Feature=detailSections[item.id];
  return <main className="u2-page">
    <PageHead crumb={`UTILITIES / ${item.label.toUpperCase()}`} title={item.label} subtitle={item.summary} action={<ActionLink onClick={()=>onNavigate('utilities')}>All utilities</ActionLink>}/>
    {!equipmentOnly&&<ItemOverview item={item}/>}
    <div className="u2-section-gap"><SectionTitle title={`${item.label} overview`}/></div>
    {item.id!=='electricity'&&<BillBreakdown item={item}/>}

    <Feature item={item} onNavigate={onNavigate}/>
    {!equipmentOnly&&<UsageHistoryPanel key={`${item.id}-${profile.homeName}`} item={item} onNavigate={onNavigate}/>}
    {item.id==='waste'&&<WasteReminders/>}
    {!equipmentOnly&&<div className="u2-section-gap"><DemoPayment item={item} paid={Boolean(paidBills[item.id])} onPay={onDemoPay}/></div>}
    <div className="u2-section-gap"><ServiceTile item={item}/></div>
  </main>;
}
