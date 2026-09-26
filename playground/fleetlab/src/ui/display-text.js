/** UI words only. Exact model records are retained separately. */
export function displayText(value){
 const maps={forecast:'Staged from a declared wave estimate',forecast_count:'Declared wave estimate',forecast_published_minute:'Estimate publication minute',forecast_valid_until_minute:'Estimate expiry minute',forecast_error_port_minutes:'Port-minutes of status error',prediction_error_port_minutes:'Port-minutes of status error',equal_share:'Equal power shares',redistribute:'Redistribute unused power',deadline:'Deadline first',last_known:'Last-known status',fresh_only:'Fresh status only',reactive:'Respond to requests',airport_forecast:'Airport preparation',charging_redistribution:'Charging redistribution',charging_deadlines:'Charging deadlines',resource_freshness:'Resource freshness','Forecast preparation':'Airport preparation'};
 const raw=String(value??'not available: no recorded value');
 return (maps[raw]??raw).replace(/(\d)[\u2013\u2014](?=\d)/g,'$1 to ').replace(/[\u2013\u2014]/g,', ').replace(/forecast(?:s|ed|ing)?/gi,'declared wave estimate').replace(/prediction error port minutes/gi,'Port-minutes of status error');
}
export function setBusy(button,busy,unavailable=false){button.disabled=unavailable||(busy&&globalThis.document?.activeElement!==button);button.setAttribute('aria-disabled',String(busy||unavailable));}
