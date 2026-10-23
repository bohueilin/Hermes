/** Public vehicle context, kept separate from editable teaching-model parameters. */
const seating='https://support.google.com/waymo/answer/9059053?hl=en-GB';
export const VEHICLE_PROFILES=Object.freeze({
  ipace:Object.freeze({label:'Jaguar I-PACE',body_style:'SUV',operational_status:'ILLUSTRATIVE_ASSUMPTIONS',
    published:Object.freeze({max_riders:4,nominal_battery_kwh:90,retail_charge_reference:'2019 retail reference: approximately 0–80% in 40 minutes on a 100 kW charger; not a fleet charge curve.'}),
    sources:Object.freeze(['https://media.jlr.com/corporate/en-us/news/2018/03/2019-jaguar-i-pace',seating]),
    limitation:'84 kWh model capacity, energy intensity, boarding and depot times are editable assumptions; retail nominal capacity does not establish fleet usable energy.'}),
  ojai:Object.freeze({label:'Ojai',body_style:'Minivan',operational_status:'ILLUSTRATIVE_ASSUMPTIONS',
    published:Object.freeze({max_riders:4,nominal_battery_kwh:null,features:'Public introduction describes elevator-like doors, low step, flat floor and sixth-generation Waymo Driver.'}),
    sources:Object.freeze(['https://waymo.com/blog/2026/05/welcoming-riders-in-the-ojai/',seating]),
    limitation:'90 kWh model capacity and 150 kW charge acceptance are invented editable illustrations, not published Ojai specifications or borrowed Zeekr MIX specifications.'}),
});
export function defaultVehicleProfiles() {
  return {
    ipace:{battery_kwh:84,charge_limit_kw:100,energy_kwh_per_km:0.24,boarding_minutes:2,cleaning_multiplier:1,software_multiplier:1,upload_multiplier:1},
    ojai:{battery_kwh:90,charge_limit_kw:150,energy_kwh_per_km:0.27,boarding_minutes:2,cleaning_multiplier:1.25,software_multiplier:1,upload_multiplier:1.2},
  };
}
