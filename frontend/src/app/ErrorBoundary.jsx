import {Component} from 'react';
export default class ErrorBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  render(){
    if(this.state.failed)return <main className="wp-loading" role="alert"><h1>This view could not load</h1><p>Reload Wattch to try again. Your saved household data remains available.</p><button type="button" className="wi-button" onClick={()=>window.location.reload()}>Reload Wattch</button></main>;
    return this.props.children;
  }
}
