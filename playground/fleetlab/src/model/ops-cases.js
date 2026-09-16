// Operations casebook records (design section 4.4, contract decision 41): twenty situations an operations lead meets
// in San Francisco, in a newly opened service area, in rain, in crowded areas and around police activity, each written
// as a preregistered experiment on a proxy built from the knobs. Generated from the calibration records of the casebook
// build (2026-09-14 and 2026-09-15) and pinned by test/ops-cases.test.mjs, so a change here re-derives the pins first.
//
// Each record: id and theme; slug, the scenario name, which keys the demand trace (world.js), so it is frozen with its
// measured verdict; title, situation, proxy (what each change stands for, how it is set, what it misses), watch and
// outsideModel, the copy the setup sheet shows; base, the axis-grammar changes and congestion scalings applied to the Bay
// teaching map (factorPermille on every row of the named classes, all directions, the named hours of day on the named
// days, capped at 3000); and the preregistered experiment (question, axis, primary, guardrails), all values in engine
// units. Never a lesson or a direction: those live in the design document beside the pinned verdicts (design H-9).

import { deepFreeze } from "./schema.js";

export const OPS_THEME_IDS = Object.freeze(["sf", "new_area", "rain", "crowds", "police"]);

export const OPS_CASES = deepFreeze([
  {
    "id": "OPS-01",
    "theme": "sf",
    "slug": "ops01_sf_evening_cars",
    "title": "Evening crunch: more cars in San Francisco",
    "situation": "In the day 1 evening peak San Francisco has almost no free car, many riders wait a long time and some go unserved. An operations lead proposes starting the day with 12 more San Francisco cars. Every San Francisco car sleeps at SF-1 or SF-2, so the extra cars also join the overnight depot wave there.",
    "proxy": [
      {
        "standsFor": "Staging extra cars in San Francisco ahead of the evening peak",
        "setAs": "SUP-1.SF 40 to 52 from the start of day 1; home depots alternate SF-1 and SF-2, so each depot gains 6 home cars; every other knob as the Bay teaching map sets it",
        "misses": "Cars added for the peak only, the staff and parking that extra cars need, and extra cars kept anywhere other than SF-1 and SF-2"
      }
    ],
    "watch": "Verdict strip: the evening wait p90 primary against its margin, and the SF-2 bay wait guardrail and the day 2 morning wait guardrail each against its max harm. Depot board: the SF-2 queue and parking after the 00:30 recall against its 30 stalls, with 40 home cars and with 52. Metric by hour: San Francisco wait p90 from 16:00 to 19:00, then from 07:00 to 09:00 on day 2. Fleet state stack: the At a depot band between 00:30 and 05:45.",
    "outsideModel": [
      "Parking, charging and staff for the extra cars",
      "Depot opening hours and cleaning crew size by hour",
      "Riders who request more once waits are shorter",
      "Cars added for the peak and taken out after it",
      "Repositioning free cars toward San Francisco instead of adding cars"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does giving San Francisco 52 cars instead of 40 change San Francisco rider wait p90 in the day 1 evening peak?",
      "axis": {
        "id": "parameter:SUP-1.SF",
        "baseline": 40,
        "candidate": 52
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 57600,
            "end_s": 68400
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "depot.bay_wait_p90_s",
          "scope": {
            "depot": "SF-2"
          },
          "direction": "lower_is_better",
          "max_harm_units": 1800
        },
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 111600,
              "end_s": 118800
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        }
      ]
    }
  },
  {
    "id": "OPS-02",
    "theme": "sf",
    "slug": "ops02_late_recall",
    "title": "Late night recall: 00:30 or 02:00",
    "situation": "At 00:30 on day 2 the end of service recall sends every free car to a depot and marks the cars then on a pickup or a trip to head for a depot when they finish, while a car sent out after that moment stays on the street. Riders leaving late night venues keep requesting after midnight at the off peak rate. Moving the recall to 02:00 keeps cars on the street longer and starts the depot wave later.",
    "proxy": [
      {
        "standsFor": "Late night riders in San Francisco after midnight",
        "setAs": "No extra demand: San Francisco's off peak rate of 15 requests per hour runs through the night; POL-3 88200 (00:30) to 93600 (02:00); the morning release stays at 107100 (05:45)",
        "misses": "A surge at closing time, riders who give up after a car is assigned, night staffing at the depots, and a second recall: a car sent out after the recall is never recalled, so some cars stay idle on the street all night"
      }
    ],
    "watch": "Metric by hour: San Francisco wait from 00:00 to 03:00 on day 2. Fleet state stack: the At a depot band building from 00:30 in one arm and from 02:00 in the other, and the idle cars that never join the wave. Depot board: when the SF-2 bay queue starts and when it clears, in each arm. Verdict strip: the late night wait p50 primary against its margin, and the day 2 morning wait guardrail and the SF-2 bay wait guardrail each against its max harm.",
    "outsideModel": [
      "A closing time surge that arrives all at once",
      "Cleaning crew hours at night",
      "Night pickup conditions",
      "Charging windows before the morning",
      "Keeping a small night pool out while the rest return",
      "A second recall for cars sent out after the first"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does moving the end of service recall from 00:30 to 02:00 change San Francisco rider wait p50 from 00:30 to 02:00 on day 2?",
      "axis": {
        "id": "parameter:POL-3",
        "baseline": 88200,
        "candidate": 93600
      },
      "primary": {
        "metric": "wait.p50_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 88200,
            "end_s": 93600
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 111600,
              "end_s": 118800
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        },
        {
          "metric": "depot.bay_wait_p90_s",
          "scope": {
            "depot": "SF-2"
          },
          "direction": "lower_is_better",
          "max_harm_units": 1800
        }
      ]
    }
  },
  {
    "id": "OPS-03",
    "theme": "sf",
    "slug": "ops03_defer_depot_visits",
    "title": "Defer depot visits through the evening peak",
    "situation": "Cars go to a depot for a clean after every 10 trips, and in the day 1 evening peak that takes San Francisco cars off the street while riders go unserved. An operations lead proposes stretching the cadence to one visit every 15 trips. The model has one cadence for every hour, so the change applies all day.",
    "proxy": [
      {
        "standsFor": "Deferring routine cleaning visits until after the evening peak",
        "setAs": "DEP-7 10 to 15 for every car and every hour; service still every 3rd visit (DEP-8 3); clean 20 minutes (DEP-4 1200)",
        "misses": "A deferral limited to peak hours, cabin condition and rider feedback, maintenance due by distance rather than by visit count, and the way a longer cadence moves each car's due point rather than removing visits"
      }
    ],
    "watch": "Verdict strip: the evening unserved share primary against its margin, and the evening wait p90, SF-2 bay wait and day 2 morning wait guardrails each against its max harm. Fleet state stack: the At a depot band from 16:00 to 19:00 at 10 trips against 15, and the East Bay arrivals that move into the peak. Metric by hour: San Francisco unserved share and wait p90 in the evening peak. Depot board: the SF-2 bay queue overnight, in each arm.",
    "outsideModel": [
      "Cabin cleanliness and rider complaints between visits",
      "Maintenance triggered by distance or faults rather than visit count",
      "A deferral rule that switches on only in the peak",
      "Cleaning crew idle time when peak visits drop"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does a depot visit every 15 trips instead of every 10 change the share of San Francisco riders left unserved in the day 1 evening peak?",
      "axis": {
        "id": "parameter:DEP-7",
        "baseline": 10,
        "candidate": 15
      },
      "primary": {
        "metric": "unserved.fraction",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 57600,
            "end_s": 68400
          }
        },
        "direction": "lower_is_better",
        "margin_units": 10000
      },
      "guardrails": [
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 57600,
              "end_s": 68400
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        },
        {
          "metric": "depot.bay_wait_p90_s",
          "scope": {
            "depot": "SF-2"
          },
          "direction": "lower_is_better",
          "max_harm_units": 1800
        },
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 111600,
              "end_s": 118800
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        }
      ]
    }
  },
  {
    "id": "OPS-04",
    "theme": "sf",
    "slug": "ops04_early_release",
    "title": "Release cars to home areas earlier",
    "situation": "The Peninsula has no depot, so Peninsula cars spend the night at SF-1 and SF-2. At 05:45 on day 2 the morning release sends every car that is ready at a depot outside its home area back home, once, while a car still queued at that moment stays where it is. An operations lead proposes releasing at 05:00 so cars are in place well before the morning peak.",
    "proxy": [
      {
        "standsFor": "An earlier morning roll out of cars to their home areas",
        "setAs": "POL-4 107100 (05:45) to 104400 (05:00); the recall stays at 88200 (00:30); San Francisco cars at SF-1 and SF-2 are already in their home area, so the release moves only cars from other areas",
        "misses": "Crew start times, sending cars toward where morning requests start rather than to a home area, charging before release, and a release that acts on each car as it becomes ready"
      }
    ],
    "watch": "Fleet state stack: the Repositioning band at 05:00 against 05:45. Depot board: ready cars at SF-1 and SF-2 between 05:00 and 07:00. Metric by hour: San Francisco wait p90 from 07:00 to 09:00 on day 2. Verdict strip: the morning wait p90 primary and its interval against the margin band, and the Peninsula wait and congested empty driving guardrails each against its max harm.",
    "outsideModel": [
      "Crew and dispatcher shift start times",
      "Sending cars toward where morning requests start rather than to a home area",
      "Releasing each car as soon as it is ready",
      "Charging before the morning",
      "A depot in the Peninsula"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does releasing ready cars to their home areas at 05:00 instead of 05:45 change San Francisco rider wait p90 in the day 2 morning peak?",
      "axis": {
        "id": "parameter:POL-4",
        "baseline": 107100,
        "candidate": 104400
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 30
      },
      "guardrails": [
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "PEN",
            "window": {
              "start_s": 111600,
              "end_s": 118800
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        },
        {
          "metric": "exposure.congested_empty_s",
          "scope": {
            "window": {
              "start_s": 104400,
              "end_s": 122400
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 3600
        }
      ]
    }
  },
  {
    "id": "OPS-05",
    "theme": "new_area",
    "slug": "ops05_launch_fleet_size",
    "title": "Launch fleet size with a 12 stall depot",
    "situation": "East Bay opens as a new service area with 12 cars and a temporary depot, EB-1, with 12 stalls, 1 cleaning bay and 1 service bay. The launch team asks whether 18 cars would serve riders on the second morning, after the overnight recall has put the fleet through the depot.",
    "proxy": [
      {
        "standsFor": "A new service area that opens with a small fleet",
        "setAs": "SUP-1.EB 12 in the baseline and 18 in the candidate; DEM-1.EB 30 and DEM-2.EB 8 at plan",
        "misses": "Staged vehicle delivery, launch checks that keep cars out of service, and a fleet that grows week by week."
      },
      {
        "standsFor": "A temporary launch depot",
        "setAs": "DEP-2.EB-1 12 stalls, DEP-3.EB-1 1 cleaning bay, DEP-5.EB-1 1 service bay",
        "misses": "Depot hours, staff, charging, and overflow parking arranged at short notice."
      },
      {
        "standsFor": "Pickups spread over a wider new area",
        "setAs": "RD-2.EB 600 (10 minutes; the Bay teaching map uses 420)",
        "misses": "Where riders actually are; the model has one trip and pickup time inside each area."
      }
    ],
    "watch": "Depot board for EB-1 from D1 14:00: its 12 stall lot and the queue for its single bay with 12 cars and with 18, and any car sent on to SF-1. Depot board for EB-1 from D2 00:30: the overnight queue and the time it clears against the 05:45 release. Fleet state stack for East Bay at D2 07:00. Metric by hour: East Bay wait p90 from D2 07:00 to 09:00. Verdict strip: the morning wait p90 primary against its margin, and the East Bay unserved, EB-1 diversions and EB-1 bay wait guardrails each against its max harm.",
    "outsideModel": [
      "Staged vehicle delivery and fleet growth over weeks",
      "Launch checks and cars held out of service",
      "Staff and shift limits at a new depot",
      "Charging and battery range",
      "Rider awareness and a demand ramp in a new area",
      "Repositioning cars between areas"
    ],
    "base": {
      "changes": [
        [
          "parameter:SUP-1.EB",
          12
        ],
        [
          "parameter:DEP-2.EB-1",
          12
        ],
        [
          "parameter:DEP-3.EB-1",
          1
        ],
        [
          "parameter:DEP-5.EB-1",
          1
        ],
        [
          "parameter:RD-2.EB",
          600
        ]
      ],
      "congestion": []
    },
    "experiment": {
      "question": "With a 12 stall launch depot, does giving East Bay 18 cars instead of 12 change East Bay rider wait p90 on day 2 from 07:00 to 09:00?",
      "axis": {
        "id": "parameter:SUP-1.EB",
        "baseline": 12,
        "candidate": 18
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "EB",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "EB"
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "depot.diversions",
          "scope": {
            "depot": "EB-1"
          },
          "direction": "lower_is_better",
          "max_harm_units": 2
        },
        {
          "metric": "depot.bay_wait_p90_s",
          "scope": {
            "depot": "EB-1"
          },
          "direction": "lower_is_better",
          "max_harm_units": 1800
        }
      ]
    }
  },
  {
    "id": "OPS-06",
    "theme": "new_area",
    "slug": "ops06_demand_above_plan",
    "title": "Launch demand above plan",
    "situation": "The launch plan for East Bay assumed 30 ride requests per hour in the peaks. Suppose peak requests arrive at 45 per hour, half again above plan, while the fleet stays at 12 cars and EB-1 stays small.",
    "proxy": [
      {
        "standsFor": "Launch demand above the plan",
        "setAs": "DEM-1.EB 30 in the baseline and 45 in the candidate; DEM-2.EB 8 outside peaks in both",
        "misses": "A demand ramp over weeks, waitlists or pricing, riders who stop requesting after a long wait, and a destination mix specific to a new area."
      },
      {
        "standsFor": "The launch fleet and depot",
        "setAs": "SUP-1.EB 12; RD-2.EB 600; EB-1 with DEP-2.EB-1 12, DEP-3.EB-1 1, DEP-5.EB-1 1",
        "misses": "Cars added from a staging pool once demand is seen."
      },
      {
        "standsFor": "Borrowing cars across area lines",
        "setAs": "Nearest idle dispatch as the Bay teaching map sets it (not an axis)",
        "misses": "Rules that keep cars inside a service area or cap cross area pickups."
      }
    ],
    "watch": "Verdict strip: the East Bay morning wait p90 primary against its margin, and the East Bay unserved guardrail next to the San Francisco unserved guardrail, each against its max harm. Metric by hour: East Bay and San Francisco wait p90 in the D1 morning peak. Fleet state stack for San Francisco from 07:00: the idle band beside the cars on pickup legs to East Bay, in each arm.",
    "outsideModel": [
      "Demand that ramps over days or weeks",
      "Waitlists, pricing and promotions",
      "Riders who stop requesting after long waits",
      "Cancellation after assignment",
      "A destination mix specific to a new area",
      "Rules that keep cars inside their service area"
    ],
    "base": {
      "changes": [
        [
          "parameter:SUP-1.EB",
          12
        ],
        [
          "parameter:DEP-2.EB-1",
          12
        ],
        [
          "parameter:DEP-3.EB-1",
          1
        ],
        [
          "parameter:DEP-5.EB-1",
          1
        ],
        [
          "parameter:RD-2.EB",
          600
        ]
      ],
      "congestion": []
    },
    "experiment": {
      "question": "With the 12 car launch fleet, do 45 East Bay peak requests per hour instead of the planned 30 change East Bay rider wait p90 in the day 1 morning peak?",
      "axis": {
        "id": "parameter:DEM-1.EB",
        "baseline": 30,
        "candidate": 45
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "EB",
          "window": {
            "start_s": 25200,
            "end_s": 32400
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "EB"
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "SF"
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        }
      ]
    }
  },
  {
    "id": "OPS-07",
    "theme": "new_area",
    "slug": "ops07_launch_depot_bays",
    "title": "One cleaning bay or three at the launch depot",
    "situation": "EB-1 opens with 1 cleaning bay, and after the end of service recall East Bay cars queue for it into the night. The launch team asks whether 2 more bays would put more East Bay cars on the road for the second morning peak.",
    "proxy": [
      {
        "standsFor": "A small launch depot",
        "setAs": "DEP-3.EB-1 1 in the baseline and 3 in the candidate; DEP-2.EB-1 12 stalls, DEP-5.EB-1 1 service bay",
        "misses": "Staff to work the bays, depot hours, and the time it takes to add a bay."
      },
      {
        "standsFor": "The overnight return to depot",
        "setAs": "POL-3 recall D2 00:30 and POL-4 release D2 05:45 as the Bay teaching map sets them; DEP-4 1200 s clean every visit, DEP-6 2700 s service every third visit (DEP-8 3)",
        "misses": "Charging, inspection, and cars held at the depot until a planned start time."
      },
      {
        "standsFor": "The launch fleet",
        "setAs": "SUP-1.EB 12; RD-2.EB 600; DEM-1.EB 30, DEM-2.EB 8",
        "misses": "Repositioning cars back to their area before the peak."
      }
    ],
    "watch": "Depot board for EB-1 from D2 00:30 to 07:00: the queue with 1 bay and with 3, and the time it empties. Fleet state stack for East Bay at D2 07:00. Verdict strip: the morning wait p90 primary and its interval against the margin band, and the EB-1 bay wait, East Bay availability and East Bay unserved guardrails each against its max harm.",
    "outsideModel": [
      "Staff to work extra bays and depot opening hours",
      "Time to build or lease bays",
      "Charging and inspection steps",
      "Cars held at the depot until a planned start",
      "Repositioning cars home before the morning peak"
    ],
    "base": {
      "changes": [
        [
          "parameter:SUP-1.EB",
          12
        ],
        [
          "parameter:DEP-2.EB-1",
          12
        ],
        [
          "parameter:DEP-3.EB-1",
          1
        ],
        [
          "parameter:DEP-5.EB-1",
          1
        ],
        [
          "parameter:RD-2.EB",
          600
        ]
      ],
      "congestion": []
    },
    "experiment": {
      "question": "Does giving the East Bay launch depot EB-1 3 cleaning bays instead of 1 change East Bay rider wait p90 on day 2 from 07:00 to 09:00?",
      "axis": {
        "id": "parameter:DEP-3.EB-1",
        "baseline": 1,
        "candidate": 3
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "EB",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "depot.bay_wait_p90_s",
          "scope": {
            "depot": "EB-1"
          },
          "direction": "lower_is_better",
          "max_harm_units": 600
        },
        {
          "metric": "fleet.available_fraction",
          "scope": {
            "area": "EB",
            "window": {
              "start_s": 108000,
              "end_s": 118800
            }
          },
          "direction": "higher_is_better",
          "max_harm_units": 20000
        },
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "EB"
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        }
      ]
    }
  },
  {
    "id": "OPS-08",
    "theme": "new_area",
    "slug": "ops08_overflow_across_bay",
    "title": "Launch lot overflow: nearest depot with a free stall",
    "situation": "EB-1 has only 6 stalls for the 12 launch cars, and cars queued for its single cleaning bay keep their stalls, so on the first afternoon East Bay cars reach a full lot and are sent on to SF-1. The alternative rule sends every car, in every area, to the nearest depot that still has a free stall when it leaves.",
    "proxy": [
      {
        "standsFor": "A launch lot too small for the fleet",
        "setAs": "DEP-2.EB-1 6 with SUP-1.EB 12; DEP-3.EB-1 1, DEP-5.EB-1 1; RD-2.EB 600",
        "misses": "Overflow parking outside a depot, and a lot that is full for only a few hours."
      },
      {
        "standsFor": "A capacity aware depot choice",
        "setAs": "policy:depot_assignment home_depot in the baseline and nearest_depot_with_capacity in the candidate, for the whole fleet",
        "misses": "Dispatcher judgment, stall reservations, a rule scoped to one area, and a rule that counts free bays as well as stalls."
      },
      {
        "standsFor": "Depot locations",
        "setAs": "The Bay teaching map depots; SF-1 and SF-2 share a travel time from every place, so a tie goes to SF-1 by id",
        "misses": "Real depots at different distances that would split the overflow."
      }
    ],
    "watch": "Depot board for EB-1 from D1 12:00: its 6 stall lot and the queue for its bay, and where cars go once the lot is full under each rule. Depot board for SF-1 and SF-2 from D2 00:30: how the overnight wave splits between the two San Francisco depots under each rule. Fleet state stack for East Bay at D2 07:00. Verdict strip: the East Bay morning wait p90 primary against its margin, and the congested empty driving, SF-1 lot peak and SF-1 bay wait guardrails each against its max harm.",
    "outsideModel": [
      "Real depot locations at different distances",
      "Overflow parking arrangements outside a depot",
      "Dispatcher judgment and stall reservations",
      "A depot choice that counts free bays",
      "Staff at the receiving depot",
      "Night road conditions on the overflow route"
    ],
    "base": {
      "changes": [
        [
          "parameter:SUP-1.EB",
          12
        ],
        [
          "parameter:DEP-2.EB-1",
          6
        ],
        [
          "parameter:DEP-3.EB-1",
          1
        ],
        [
          "parameter:DEP-5.EB-1",
          1
        ],
        [
          "parameter:RD-2.EB",
          600
        ]
      ],
      "congestion": []
    },
    "experiment": {
      "question": "With 6 stalls at EB-1, does sending cars to the nearest depot with a free stall instead of their home depot change East Bay rider wait p90 on day 2 from 07:00 to 09:00?",
      "axis": {
        "id": "policy:depot_assignment",
        "baseline": "home_depot",
        "candidate": "nearest_depot_with_capacity"
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "EB",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "exposure.congested_empty_s",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 18000
        },
        {
          "metric": "depot.parking_peak_fraction",
          "scope": {
            "depot": "SF-1"
          },
          "direction": "lower_is_better",
          "max_harm_units": 100000
        },
        {
          "metric": "depot.bay_wait_p90_s",
          "scope": {
            "depot": "SF-1"
          },
          "direction": "lower_is_better",
          "max_harm_units": 600
        }
      ]
    }
  },
  {
    "id": "OPS-09",
    "theme": "rain",
    "slug": "ops09_rain_slower_pickups_sf",
    "title": "Rain: slower curbside pickups in San Francisco",
    "situation": "Rain slows every road on the afternoon and evening of day 1 and brings more San Francisco requests. Wet curbs also stretch each pickup and each short trip inside San Francisco. An operations lead asks whether that slower curbside time is what hurts the evening peak.",
    "proxy": [
      {
        "standsFor": "Rain on the roads from the afternoon into the night of day 1",
        "setAs": "scaleCongestion ×1.35 on every HIGHWAY, LOCAL and IN_AREA row, all directions, day 1 hours 13 to 22 (13:00 to 23:00), capped at ×3.0",
        "misses": "Rain that starts, stops or differs by area; any change in how cars drive; road closures."
      },
      {
        "standsFor": "More San Francisco requests on a rainy day",
        "setAs": "DEM-1.SF 75 per hour in peaks (Bay teaching map 60) and DEM-2.SF 19 off peak (15), on both days",
        "misses": "A rise limited to the rain hours: demand can only change per area for peak and off peak hours across both days; riders who give up before booking."
      },
      {
        "standsFor": "Slower curbside pickups and short trips in San Francisco (the axis)",
        "setAs": "RD-2.SF 360 s in the baseline, 540 s in the candidate, all day on both days",
        "misses": "Pickups that slow only while it rains; walking to the car; riders who cancel after a car is assigned."
      }
    ],
    "watch": "Metric by hour: San Francisco unserved requests in the 07:00 and 08:00 hours of day 1 with 6 minute pickups and with 9, then the wait p90 in the 16:00 to 18:00 hours in each arm, and San Jose and Peninsula unserved by hour across the day. Fleet state stack: the available band in San Francisco from 16:00 in each arm, and the cars from the East Bay and the Peninsula on pickup legs into San Francisco. Depot board: the depots in each arm, to see whether anything changes there. Verdict strip: the evening wait p90 primary and its interval against the margin band, and the whole run unserved guardrail next to the evening window unserved guardrail, each against its max harm.",
    "outsideModel": [
      "Rain that varies by hour and by area",
      "Riders who decide not to book or who cancel after assignment",
      "Pickup spot choice, walking time and waiting under cover",
      "Road surface, visibility and any vehicle response to rain",
      "Demand that returns to normal once the rain stops"
    ],
    "base": {
      "changes": [
        [
          "parameter:DEM-1.SF",
          75
        ],
        [
          "parameter:DEM-2.SF",
          19
        ]
      ],
      "congestion": [
        {
          "classes": [
            "HIGHWAY",
            "LOCAL",
            "IN_AREA"
          ],
          "hours": [
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21,
            22
          ],
          "days": [
            1
          ],
          "factorPermille": 1350
        }
      ]
    },
    "experiment": {
      "question": "In the rain world, does a San Francisco pickup and in area trip time of 9 minutes instead of 6 change San Francisco rider wait p90 from 16:00 to 19:00 on day 1?",
      "axis": {
        "id": "parameter:RD-2.SF",
        "baseline": 360,
        "candidate": 540
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 57600,
            "end_s": 68400
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 57600,
              "end_s": 68400
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 20000
        }
      ]
    }
  },
  {
    "id": "OPS-10",
    "theme": "rain",
    "slug": "ops10_rain_more_cars_sf",
    "title": "Rain: more cars for San Francisco",
    "situation": "The rain world slows every road on the afternoon and evening of day 1, adds 2 minutes to every pickup and brings about 25 percent more San Francisco requests. The team can place 8 more cars in San Francisco at the start of the run. The question is whether those cars add more served rides in rain than on a dry day, and what they ask of the depots.",
    "proxy": [
      {
        "standsFor": "Rain on the roads from the afternoon into the night of day 1",
        "setAs": "scaleCongestion ×1.35 on every HIGHWAY, LOCAL and IN_AREA row, all directions, day 1 hours 13 to 22 (13:00 to 23:00), capped at ×3.0",
        "misses": "Rain that starts, stops or differs by area; any change in how cars drive; road closures."
      },
      {
        "standsFor": "Slower curbside pickups everywhere",
        "setAs": "RD-2.SF 480 s, RD-2.PEN 600 s, RD-2.SJ 600 s, RD-2.EB 540 s (each 2 minutes above the Bay teaching map), all day on both days",
        "misses": "Pickups that slow only while it rains; walking to the car."
      },
      {
        "standsFor": "More San Francisco requests on a rainy day",
        "setAs": "DEM-1.SF 75 per hour in peaks (60) and DEM-2.SF 19 off peak (15), on both days",
        "misses": "A rise limited to the rain hours; riders who give up before booking."
      },
      {
        "standsFor": "Extra cars for San Francisco (the axis)",
        "setAs": "SUP-1.SF 40 in the baseline, 48 in the candidate, present from the start of day 1",
        "misses": "Cars added only when rain starts; the staff and preparation extra cars need; charging."
      }
    ],
    "watch": "Metric by hour: unserved requests on day 1 before 13:00, during the rain hours and on the day 2 morning, in both arms. Depot board: the SF-2 queue and parking after the 00:30 recall with 40 cars and with 48, and when each clears against the 07:00 peak. Fleet state stack: the at depot band on day 2 from 04:00 to 07:00. Verdict strip: the whole run unserved primary against its margin, and the 06:00 availability, SF-2 blocked time and empty driving guardrails each against its max harm.",
    "outsideModel": [
      "Adding cars partway through the day when rain starts",
      "Staff, preparation and charging for extra cars",
      "Demand that falls back after the rain",
      "Repositioning idle cars between areas",
      "Riders who cancel after assignment"
    ],
    "base": {
      "changes": [
        [
          "parameter:RD-2.SF",
          480
        ],
        [
          "parameter:RD-2.PEN",
          600
        ],
        [
          "parameter:RD-2.SJ",
          600
        ],
        [
          "parameter:RD-2.EB",
          540
        ],
        [
          "parameter:DEM-1.SF",
          75
        ],
        [
          "parameter:DEM-2.SF",
          19
        ]
      ],
      "congestion": [
        {
          "classes": [
            "HIGHWAY",
            "LOCAL",
            "IN_AREA"
          ],
          "hours": [
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21,
            22
          ],
          "days": [
            1
          ],
          "factorPermille": 1350
        }
      ]
    },
    "experiment": {
      "question": "In the rain world, does giving San Francisco 48 cars instead of 40 change the whole run unserved fraction?",
      "axis": {
        "id": "parameter:SUP-1.SF",
        "baseline": 40,
        "candidate": 48
      },
      "primary": {
        "metric": "unserved.fraction",
        "scope": {},
        "direction": "lower_is_better",
        "margin_units": 5000
      },
      "guardrails": [
        {
          "metric": "fleet.available_fraction",
          "scope": {
            "window": {
              "start_s": 108000,
              "end_s": 111600
            }
          },
          "direction": "higher_is_better",
          "max_harm_units": 20000
        },
        {
          "metric": "depot.blocked_s",
          "scope": {
            "depot": "SF-2"
          },
          "direction": "lower_is_better",
          "max_harm_units": 0
        },
        {
          "metric": "vehicle.empty_drive_fraction",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 20000
        }
      ]
    }
  },
  {
    "id": "OPS-11",
    "theme": "rain",
    "slug": "ops11_rain_longer_cleans",
    "title": "Rain: wet interiors and 30 minute cleans",
    "situation": "Riders bring water and grit into cars on a rainy day, so each depot clean takes longer. In the rain world every clean at all four depots goes from 20 minutes to 30 minutes. Most depot visits in this model arrive after the 00:30 recall, before the day 2 morning peak.",
    "proxy": [
      {
        "standsFor": "Rain on the roads from the afternoon into the night of day 1",
        "setAs": "scaleCongestion ×1.35 on every HIGHWAY, LOCAL and IN_AREA row, all directions, day 1 hours 13 to 22 (13:00 to 23:00), capped at ×3.0",
        "misses": "Rain that starts, stops or differs by area; any change in how cars drive."
      },
      {
        "standsFor": "Slower curbside pickups everywhere",
        "setAs": "RD-2.SF 480 s, RD-2.PEN 600 s, RD-2.SJ 600 s, RD-2.EB 540 s, all day on both days",
        "misses": "Pickups that slow only while it rains."
      },
      {
        "standsFor": "More San Francisco requests on a rainy day",
        "setAs": "DEM-1.SF 75 and DEM-2.SF 19, on both days",
        "misses": "A rise limited to the rain hours."
      },
      {
        "standsFor": "Wet interiors that need a longer clean (the axis)",
        "setAs": "DEP-4 1200 s in the baseline, 1800 s in the candidate, at every depot for every visit on both days",
        "misses": "Only cars that carried riders in rain needing the longer clean; a quick wipe instead of a full clean; cleaning staff limits and drying time."
      }
    ],
    "watch": "Depot board: SF-2 and SJ-1 queues from the 00:30 recall to the 05:45 release in both arms. Fleet state stack: the at depot band on day 2 from 04:00 to 07:00. Verdict strip: the morning wait p90 primary and its interval against the margin band, and the whole run unserved, 06:00 readiness and SF-2 bay wait guardrails each against its max harm.",
    "outsideModel": [
      "Which cars actually got wet and how dirty they are",
      "Cleaning staff on the night shift and their breaks",
      "A quick clean option for lightly used cars",
      "Depot opening hours",
      "Drying time and supplies"
    ],
    "base": {
      "changes": [
        [
          "parameter:RD-2.SF",
          480
        ],
        [
          "parameter:RD-2.PEN",
          600
        ],
        [
          "parameter:RD-2.SJ",
          600
        ],
        [
          "parameter:RD-2.EB",
          540
        ],
        [
          "parameter:DEM-1.SF",
          75
        ],
        [
          "parameter:DEM-2.SF",
          19
        ]
      ],
      "congestion": [
        {
          "classes": [
            "HIGHWAY",
            "LOCAL",
            "IN_AREA"
          ],
          "hours": [
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21,
            22
          ],
          "days": [
            1
          ],
          "factorPermille": 1350
        }
      ]
    },
    "experiment": {
      "question": "In the rain world, does a 30 minute clean instead of a 20 minute clean change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?",
      "axis": {
        "id": "parameter:DEP-4",
        "baseline": 1200,
        "candidate": 1800
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "fleet.available_fraction",
          "scope": {
            "window": {
              "start_s": 108000,
              "end_s": 111600
            }
          },
          "direction": "higher_is_better",
          "max_harm_units": 20000
        },
        {
          "metric": "depot.bay_wait_p90_s",
          "scope": {
            "depot": "SF-2"
          },
          "direction": "lower_is_better",
          "max_harm_units": 900
        }
      ]
    }
  },
  {
    "id": "OPS-12",
    "theme": "rain",
    "slug": "ops12_rain_bays_where_queue_is",
    "title": "Rain: add bays where the queue reaches riders",
    "situation": "With 30 minute cleans in the rain world, every depot runs a long queue after the 00:30 recall. SF-2 has the longest bay wait and cars still in its queue at 07:00, so it looks like the place for 2 more cleaning bays. The team tests the same 2 bays at SJ-1 and compares.",
    "proxy": [
      {
        "standsFor": "Rain on the roads from the afternoon into the night of day 1",
        "setAs": "scaleCongestion ×1.35 on every HIGHWAY, LOCAL and IN_AREA row, all directions, day 1 hours 13 to 22 (13:00 to 23:00), capped at ×3.0",
        "misses": "Rain that starts, stops or differs by area; any change in how cars drive."
      },
      {
        "standsFor": "Slower curbside pickups everywhere and more San Francisco requests",
        "setAs": "RD-2.SF 480 s, RD-2.PEN 600 s, RD-2.SJ 600 s, RD-2.EB 540 s; DEM-1.SF 75 and DEM-2.SF 19; all on both days",
        "misses": "Changes limited to the rain hours."
      },
      {
        "standsFor": "Wet interiors that need a longer clean",
        "setAs": "DEP-4 1800 s in both arms",
        "misses": "Only wet cars needing the longer clean; staff limits."
      },
      {
        "standsFor": "Two more cleaning bays (the axis)",
        "setAs": "DEP-3.SJ-1 3 in the baseline, 5 in the candidate; a contrast run moves DEP-3.SF-2 from 2 to 4 with the same primary and guardrails",
        "misses": "Space, staff and lead time to open a bay; moving idle cars between areas, which the model does not do."
      }
    ],
    "watch": "Depot board: the SJ-1 queue between the 00:30 recall and 04:00 in both arms, next to the SF-2 queue over the same hours. Fleet state stack: cars available in San Francisco around 07:00 on day 2. Metric by hour: San Francisco wait p90 in the 07:00 and 08:00 hours of day 2. Verdict strip: the San Francisco morning wait p90 primary against its margin, and the whole run unserved, empty driving and San Jose morning wait guardrails each against its max harm.",
    "outsideModel": [
      "Repositioning idle cars between areas before the morning peak",
      "Staff and space to open bays",
      "Dispatch rules other than nearest idle car",
      "Depot opening hours",
      "Which cars actually need the longer clean"
    ],
    "base": {
      "changes": [
        [
          "parameter:RD-2.SF",
          480
        ],
        [
          "parameter:RD-2.PEN",
          600
        ],
        [
          "parameter:RD-2.SJ",
          600
        ],
        [
          "parameter:RD-2.EB",
          540
        ],
        [
          "parameter:DEM-1.SF",
          75
        ],
        [
          "parameter:DEM-2.SF",
          19
        ],
        [
          "parameter:DEP-4",
          1800
        ]
      ],
      "congestion": [
        {
          "classes": [
            "HIGHWAY",
            "LOCAL",
            "IN_AREA"
          ],
          "hours": [
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21,
            22
          ],
          "days": [
            1
          ],
          "factorPermille": 1350
        }
      ]
    },
    "experiment": {
      "question": "With 30 minute cleans in the rain world, does raising SJ-1 from 3 cleaning bays to 5 change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?",
      "axis": {
        "id": "parameter:DEP-3.SJ-1",
        "baseline": 3,
        "candidate": 5
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "vehicle.empty_drive_fraction",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 20000
        },
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "SJ",
            "window": {
              "start_s": 111600,
              "end_s": 118800
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        }
      ]
    }
  },
  {
    "id": "OPS-13",
    "theme": "crowds",
    "slug": "ops13_crowded_curbs_sf",
    "title": "Crowded curbs slow every downtown pickup",
    "situation": "Crowds on downtown sidewalks make every pickup in San Francisco and every trip that stays inside it slower, because a car waits longer at the curb. The teaching model has no pedestrians, so the case lengthens the trip and pickup time inside San Francisco from 6 to 10 minutes and asks which rider waits feel it.",
    "proxy": [
      {
        "standsFor": "Crowded downtown curbs: a car waits longer for riders to reach it and to step out, on every San Francisco pickup and every trip that stays inside San Francisco",
        "setAs": "parameter:RD-2.SF 360 s (baseline) to 600 s (candidate), every hour of both days. The congestion row for travel inside areas keeps its ×1.3 in both peaks, so a peak pickup inside San Francisco plans 468 s at baseline and 780 s in the candidate.",
        "misses": "The model has no pedestrians and no curb space: the delay is a fixed longer travel time, applied all day rather than only while crowds are out. Failed pickups, riders walking to a car, trips between areas and depot access are not affected. 10 minutes is the largest value allowed without also raising rider patience, which must be at least every area's trip time inside the area."
      }
    ],
    "watch": "Metric by hour: San Francisco wait p90 in the 07:00 and 08:00 hours, then in the 16:00 to 18:00 hours, in each arm. Fleet state stack: the idle band in San Francisco through the morning peak. Verdict strip: the morning wait p90 primary against its margin, and the evening wait guardrail and the San Francisco unserved guardrail each against its max harm.",
    "outsideModel": [
      "Pedestrian volumes and where crowds gather by hour",
      "Curb space, loading zones and pickup rules",
      "Riders walking to a meeting point, and failed pickups",
      "A delay that applies only while crowds are present"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does raising the San Francisco trip and pickup time inside the area from 6 minutes to 10 minutes change San Francisco rider wait p90 in the day 1 morning peak?",
      "axis": {
        "id": "parameter:RD-2.SF",
        "baseline": 360,
        "candidate": 600
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 25200,
            "end_s": 32400
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "SF"
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 57600,
              "end_s": 68400
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        }
      ]
    }
  },
  {
    "id": "OPS-14",
    "theme": "crowds",
    "slug": "ops14_event_lets_out_sf",
    "title": "An event lets out in San Francisco",
    "situation": "A stadium event ends in San Francisco and many people ask for rides in the evening peak. The model has no crowd that leaves at once, so the case raises San Francisco peak requests by half and watches a neighbouring area that shares the same cars.",
    "proxy": [
      {
        "standsFor": "Riders leaving a stadium event in San Francisco",
        "setAs": "parameter:DEM-1.SF 60 to 90 requests per hour. The knob sets both peak windows (07:00 to 09:00 and 16:00 to 19:00) on both days, so both mornings get the extra requests too. The destination mix stays at the map default: 84 of every 100 San Francisco evening peak trips go to another area.",
        "misses": "A real crowd leaves in a short burst after the event ends; here the extra requests spread evenly over every peak hour of both days. No venue location, no group rides, no closed streets near the venue, no pedestrians."
      },
      {
        "standsFor": "Cars borrowed across areas when a busy area runs out",
        "setAs": "Map default nearest idle dispatch: a waiting rider takes the car with the earliest planned arrival, from any area.",
        "misses": "No limit on how far a car may be sent, no staging of cars before the event, no rider choice to wait for a closer car."
      }
    ],
    "watch": "Metric by hour: East Bay, Peninsula and San Jose unserved in the 16:00 to 18:00 hours, in each arm. Fleet state stack: the idle band outside San Francisco through the evening peak. Verdict strip: the East Bay unserved primary against its margin, and the East Bay wait p90 guardrail and the San Francisco unserved guardrail each against its max harm.",
    "outsideModel": [
      "A crowd that leaves at once in a short burst",
      "Venue location, event timing and closed streets nearby",
      "Staging cars near the venue before the event ends",
      "Riders sharing rides or walking away from the venue first"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does raising San Francisco peak requests from 60 to 90 per hour change the East Bay unserved fraction in the day 1 evening peak?",
      "axis": {
        "id": "parameter:DEM-1.SF",
        "baseline": 60,
        "candidate": 90
      },
      "primary": {
        "metric": "unserved.fraction",
        "scope": {
          "area": "EB",
          "window": {
            "start_s": 57600,
            "end_s": 68400
          }
        },
        "direction": "lower_is_better",
        "margin_units": 10000
      },
      "guardrails": [
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "EB",
            "window": {
              "start_s": 57600,
              "end_s": 68400
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        },
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 57600,
              "end_s": 68400
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 20000
        }
      ]
    }
  },
  {
    "id": "OPS-15",
    "theme": "crowds",
    "slug": "ops15_neighbour_adds_cars",
    "title": "The neighbour adds cars for an event next door",
    "situation": "The OPS-14 world: a stadium event in San Francisco stands as 90 peak requests per hour instead of 60, and San Francisco shares its cars with the East Bay under nearest idle dispatch. The East Bay operations lead asks for 8 more cars for the day to protect East Bay riders. The model has no way to keep cars inside one area, so the case asks whether cars added in the neighbouring area stay there.",
    "proxy": [
      {
        "standsFor": "An event night in San Francisco (the OPS-14 event proxy)",
        "setAs": "Base: parameter:DEM-1.SF 90 requests per hour (map default 60), which applies to both peak windows on both days; destination mix at the map default.",
        "misses": "The extra requests spread over every peak hour of both days instead of arriving in one burst."
      },
      {
        "standsFor": "Extra cars brought in for the day to protect the East Bay",
        "setAs": "parameter:SUP-1.EB 24 cars (baseline) to 32 cars (candidate), for the whole run, all homed at EB-1 (30 stalls, 2 cleaning bays, 1 service bay).",
        "misses": "The cars are present all run, not only for the event; there is no rule that keeps a car inside its home area, no repositioning and no cap on how far a car may be sent, so nearest idle dispatch can send any of them to San Francisco."
      }
    ],
    "watch": "Fleet state stack: East Bay cars on pickup legs into San Francisco during the 16:00 to 18:00 hours, with 24 cars and with 32. Metric by hour: East Bay and San Francisco unserved in the evening peak, in each arm. Depot board: the EB-1 queue and lot after the 00:30 recall, in each arm. Verdict strip: the East Bay unserved primary against its margin, and the EB-1 bay wait, EB-1 lot peak and San Francisco unserved guardrails each against its max harm.",
    "outsideModel": [
      "A rule that keeps cars inside their home area, or a cap on pickup distance",
      "Repositioning cars back to the East Bay between trips",
      "Cars added only for the event hours, and where they come from",
      "Depot staff and hours at EB-1 for the extra overnight work"
    ],
    "base": {
      "changes": [
        [
          "parameter:DEM-1.SF",
          90
        ]
      ],
      "congestion": []
    },
    "experiment": {
      "question": "With San Francisco at 90 peak requests per hour, does giving East Bay 32 cars instead of 24 change the East Bay unserved fraction in the day 1 evening peak?",
      "axis": {
        "id": "parameter:SUP-1.EB",
        "baseline": 24,
        "candidate": 32
      },
      "primary": {
        "metric": "unserved.fraction",
        "scope": {
          "area": "EB",
          "window": {
            "start_s": 57600,
            "end_s": 68400
          }
        },
        "direction": "lower_is_better",
        "margin_units": 10000
      },
      "guardrails": [
        {
          "metric": "depot.bay_wait_p90_s",
          "scope": {
            "depot": "EB-1"
          },
          "direction": "lower_is_better",
          "max_harm_units": 1800
        },
        {
          "metric": "depot.parking_peak_fraction",
          "scope": {
            "depot": "EB-1"
          },
          "direction": "lower_is_better",
          "max_harm_units": 100000
        },
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 57600,
              "end_s": 68400
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        }
      ]
    }
  },
  {
    "id": "OPS-16",
    "theme": "crowds",
    "slug": "ops16_evening_streets_full",
    "title": "Streets full of people in the evening peak",
    "situation": "A street festival and evening crowds slow every drive inside the city areas during the evening peak. The model has one congestion row for travel inside areas, shared by all four areas, so the proxy slows San Francisco, Peninsula, San Jose and East Bay streets together.",
    "proxy": [
      {
        "standsFor": "Streets full of people in the evening peak: slower driving inside every area",
        "setAs": "parameter:RD-3.in_area.evening 1300 to 2000 per mille on the 16:00, 17:00 and 18:00 hours of both days. The congestion row for travel inside areas is one row shared by all four areas, and it also times the 5 minute depot access legs, so every area and every depot entry slows at once. Highway and local routes between areas keep their defaults.",
        "misses": "Crowds in one area only cannot be set with this knob; there are no pedestrians, no closed streets and no walking to a pickup point, and the slowdown starts and ends on the hour instead of building and fading."
      }
    ],
    "watch": "Metric by hour: unserved in every area in the 16:00 to 18:00 hours, in each arm. Fleet state stack: cars on pickups and trips at the same time beside the idle band, in each arm. Verdict strip: the map wide unserved primary against its margin, and the San Francisco wait p90, loaded congested exposure and whole run unserved guardrails each against its max harm, on each of the three seed sets.",
    "outsideModel": [
      "Crowds confined to one area or a few streets",
      "Pedestrians crossing and street closures for a festival",
      "Riders walking to a pickup point away from the crowd",
      "Slowdowns that build and fade instead of starting on the hour"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does traffic inside areas of ×2.0 instead of ×1.3 from 16:00 to 19:00 change the share of riders left unserved across the map from 17:00 to 20:00 on day 1?",
      "axis": {
        "id": "parameter:RD-3.in_area.evening",
        "baseline": 1300,
        "candidate": 2000
      },
      "primary": {
        "metric": "unserved.fraction",
        "scope": {
          "window": {
            "start_s": 61200,
            "end_s": 72000
          }
        },
        "direction": "lower_is_better",
        "margin_units": 10000
      },
      "guardrails": [
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "SF",
            "window": {
              "start_s": 61200,
              "end_s": 72000
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 120
        },
        {
          "metric": "exposure.congested_loaded_s",
          "scope": {
            "window": {
              "start_s": 61200,
              "end_s": 72000
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 3600
        },
        {
          "metric": "unserved.fraction",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 10000
        }
      ]
    }
  },
  {
    "id": "OPS-17",
    "theme": "police",
    "slug": "ops17_h1_closure_peninsula",
    "title": "Highway closure between SF and the Peninsula",
    "situation": "A police closure shuts highway H1 between San Francisco and the Peninsula for the whole run, so every car between the two areas takes local route L1. The Peninsula has no depot, and in the morning most of its riders travel to San Francisco and take Peninsula cars with them.",
    "proxy": [
      {
        "standsFor": "A closure of highway H1 with traffic detouring on local route L1 for the whole run.",
        "setAs": "parameter:RD-1.H1 free flow 1500 s to 5400 s on both days. L1 stays at 3300 s (4290 s at x1.3 in peaks), which is faster than H1 at every hour, so every SF to PEN leg uses L1 in the candidate arm.",
        "misses": "A closure that starts and ends at a clock time, queues at the closure point, detour traffic slowing L1, cars already on H1 when it closes, riders changing their trips."
      },
      {
        "standsFor": "Peninsula cars sent to the depot that is quickest to reach while the closure lasts.",
        "setAs": "No separate knob: home depots are chosen from free flow route times when the run starts, so the same RD-1.H1 change moves the Peninsula home depot set from SF-1 and SF-2 to SJ-1 (H4, 1800 s).",
        "misses": "A planner deciding whether and when to rehome cars; here the new homes apply for the whole run on both days, and the first depot visit of the run comes after the day 1 morning window."
      }
    ],
    "watch": "Metric by hour: Peninsula wait p90 in hours 07 and 08 of day 1 in both arms, then hours 16 to 19. Depot board: SJ-1 parking after the 00:30 recall against its 30 stalls, and any diversion it records, in each arm. Verdict strip: the Peninsula morning wait p90 primary against its margin, and the Peninsula unserved, congested empty driving and SJ-1 diversion guardrails each against its max harm.",
    "outsideModel": [
      "Closure start and end times and reopening estimates",
      "Detour traffic loading the local route and other corridors",
      "Riders cancelling or changing destination because of the closure",
      "Moving spare cars into the Peninsula before the morning",
      "Messages to riders and coordination with the road authority"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does closing highway H1 for the whole run, set as 90 minutes instead of 25, change Peninsula rider wait p90 in the day 1 morning peak?",
      "axis": {
        "id": "parameter:RD-1.H1",
        "baseline": 1500,
        "candidate": 5400
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "PEN",
          "window": {
            "start_s": 25200,
            "end_s": 32400
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "PEN"
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "exposure.congested_empty_s",
          "scope": {
            "area": "PEN"
          },
          "direction": "lower_is_better",
          "max_harm_units": 18000
        },
        {
          "metric": "depot.diversions",
          "scope": {
            "depot": "SJ-1"
          },
          "direction": "lower_is_better",
          "max_harm_units": 0
        }
      ]
    }
  },
  {
    "id": "OPS-18",
    "theme": "police",
    "slug": "ops18_sf_cars_held_at_scenes",
    "title": "Cars held at incident scenes in San Francisco",
    "situation": "Police activity in San Francisco holds six cars at incident scenes, and they stay out of service for the whole run. Day 1 starts with every car idle in its own area, while day 2 starts from where the overnight recall and the depot queues left the fleet.",
    "proxy": [
      {
        "standsFor": "Cars held at incident scenes and unavailable to riders.",
        "setAs": "parameter:SUP-1.SF 40 to 34 cars for the whole run on both days; the candidate arm starts with 34 San Francisco cars, split between home depots SF-1 and SF-2.",
        "misses": "Cars stopped partway through the day and returned later, the rider on board when a car stops, time to clear a scene, an inspection before a held car returns, cars held in other areas."
      }
    ],
    "watch": "Fleet state stack: the idle band in San Francisco on the day 1 morning against the day 2 morning. Metric by hour: San Francisco wait p90 in hours 07 and 08 on both days. Verdict strip: the day 2 morning wait p90 primary against its margin, and the San Francisco unserved and Peninsula wait guardrails each against its max harm, on each of the three seed sets.",
    "outsideModel": [
      "Cars removed and returned partway through the day",
      "The rider on board when a car is held",
      "Scene clearance and inspection time",
      "Backfill from spare vehicles or moving cars between areas",
      "Rider cancellations after assignment"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does taking 6 of San Francisco's 40 cars out of service for the whole run change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?",
      "axis": {
        "id": "parameter:SUP-1.SF",
        "baseline": 40,
        "candidate": 34
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "SF"
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "wait.p90_s",
          "scope": {
            "area": "PEN",
            "window": {
              "start_s": 111600,
              "end_s": 118800
            }
          },
          "direction": "lower_is_better",
          "max_harm_units": 300
        }
      ]
    }
  },
  {
    "id": "OPS-19",
    "theme": "police",
    "slug": "ops19_service_check_every_second",
    "title": "A service check every second depot visit",
    "situation": "After police activity in the service area, every car must pass a service check more often. The model has no inspection, so the case raises the service cadence from every third depot visit to every second, on the service bays the map already has (SF-1 2, SF-2 1, SJ-1 1, EB-1 1) and with the 45 minute service. The 00:30 recall then sends the whole wave through those bays before the morning.",
    "proxy": [
      {
        "standsFor": "A post incident service check on every car, more often than the routine service.",
        "setAs": "parameter:DEP-8 3 (baseline) to 2 (candidate): every second depot visit takes the 45 minute service (DEP-6 2700 s) on a service bay after the 20 minute clean, at the service bays the map has (SF-1 2, SF-2 1, SJ-1 1, EB-1 1), for the whole run on both days.",
        "misses": "An inspection shorter than a full service, checks limited to cars that were near an incident or to a few days, staff and parts to run them, cars that fail the check and leave the fleet, checks done on the street by a mobile crew, depot hours."
      }
    ],
    "watch": "Depot board: SF-2 and EB-1, with one service bay each, from the 00:30 recall past 07:00 in each arm, the cars queued for service after their clean, and the cleaning bay wait beside the service bay wait. Fleet state stack: the at depot band at 06:00 on day 2 and the available band in San Francisco from 07:00, in each arm. Metric by hour: San Francisco wait p90 and unserved in hours 07 and 08 of day 2. Verdict strip: the morning wait p90 primary against its margin, and the San Francisco unserved, 06:00 readiness and SF-2 censored visits guardrails each against its max harm.",
    "outsideModel": [
      "An inspection shorter than a full 45 minute service",
      "Checks limited to cars that were near an incident, or to a few days",
      "Staff, parts and shift limits at the service bays",
      "Cars that fail the check and leave the fleet",
      "Checks done on the street by a mobile crew",
      "Depot opening hours and charging during longer stays"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "Does a service check every second depot visit instead of every third change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?",
      "axis": {
        "id": "parameter:DEP-8",
        "baseline": 3,
        "candidate": 2
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "unserved.fraction",
          "scope": {
            "area": "SF"
          },
          "direction": "lower_is_better",
          "max_harm_units": 10000
        },
        {
          "metric": "fleet.available_fraction",
          "scope": {
            "window": {
              "start_s": 108000,
              "end_s": 111600
            }
          },
          "direction": "higher_is_better",
          "max_harm_units": 20000
        },
        {
          "metric": "depot.censored_visits",
          "scope": {
            "depot": "SF-2"
          },
          "direction": "lower_is_better",
          "max_harm_units": 1
        }
      ]
    }
  },
  {
    "id": "OPS-20",
    "theme": "police",
    "slug": "ops20_sf1_lot_staging_area",
    "title": "A staging area on two thirds of the SF-1 lot",
    "situation": "A police staging area takes two thirds of the SF-1 lot for the whole run, leaving 20 of its 60 stalls. Cars keep returning to their home depot, so the 00:30 recall wave, which peaks at about 21 cars on the SF-1 lot, now meets a lot that fills. The question is whether San Francisco riders feel it the next morning or only the depot gate does.",
    "proxy": [
      {
        "standsFor": "Two thirds of a depot lot closed off for a staging area, with cars still sent to their home depot.",
        "setAs": "parameter:DEP-2.SF-1 60 (baseline) to 20 (candidate) stalls for the whole run, with the map's default depot assignment rule home_depot: a car turned away at a full SF-1 gate drives on to the nearest depot with a free stall, SF-2. SF-1 keeps 4 cleaning bays and 2 service bays.",
        "misses": "Staging that starts or ends partway through the run, cars already parked in the space, staging vehicles blocking the gate or bays, slower access to the depot, a dispatcher told the true stall count who rehomes cars on purpose."
      }
    ],
    "watch": "Depot board: the SF-1 lot after the 00:30 recall against its 60 stalls and against 20, any car it turns away, and when SF-2 clears in each arm against the 05:45 release. Fleet state stack: the at depot band before 07:00 on day 2, in both arms. Metric by hour: San Francisco wait p90 in hours 07 and 08 of day 2, in each arm. Verdict strip: the morning wait p90 primary and its interval against the margin band, and the diversions and empty driving guardrails each against its max harm.",
    "outsideModel": [
      "Staging that only covers part of the night",
      "Staging vehicles blocking gates, bays or access roads",
      "Temporary parking elsewhere",
      "Staff moving cars inside a crowded lot",
      "A dispatcher who knows the true stall count and sends cars elsewhere before they reach the gate"
    ],
    "base": {
      "changes": [],
      "congestion": []
    },
    "experiment": {
      "question": "With cars returning to their home depot, does cutting SF-1 from 60 parking stalls to 20 change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?",
      "axis": {
        "id": "parameter:DEP-2.SF-1",
        "baseline": 60,
        "candidate": 20
      },
      "primary": {
        "metric": "wait.p90_s",
        "scope": {
          "area": "SF",
          "window": {
            "start_s": 111600,
            "end_s": 118800
          }
        },
        "direction": "lower_is_better",
        "margin_units": 60
      },
      "guardrails": [
        {
          "metric": "depot.diversions",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 0
        },
        {
          "metric": "vehicle.empty_drive_fraction",
          "scope": {},
          "direction": "lower_is_better",
          "max_harm_units": 10000
        }
      ]
    }
  }
]);
