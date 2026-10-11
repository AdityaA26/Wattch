import {UTILITIES} from '../../../data/utilityData.js';
import {PageHead,SectionTitle,Panel,Icon,ActionLink} from '../components/UtilityUI.jsx';
export default function ConnectUtilityPage({onNavigate}){
 return <main className="u2-page"><PageHead crumb="CONNECT UTILITY" title="Bring your services together." subtitle="Your utility accounts will eventually live in one place."/>
   <div className="u2-connect-note"><Icon name="info" size={23}/><div><strong>Account connections are not enabled in this prototype.</strong><p>The utility pages use example data. Real connections need supported provider APIs, authentication, and explicit customer authorization. Do not submit utility passwords to this demo.</p></div></div>
   <div className="u2-section-gap"><SectionTitle title="Browse the available dashboards" detail="These screens are interactive previews, not connected service accounts"/></div>
   <div className="u2-connect-list">{UTILITIES.map(item=><button type="button" key={item.id} onClick={()=>onNavigate(item.id)}><span className="u2-icon" style={{background:item.tint,color:item.color}}><Icon name={item.icon}/></span><span><strong>{item.label}</strong><small>{item.summary}</small></span><b>Preview available</b><Icon name="arrow" size={17}/></button>)}</div>
 </main>;
}
