// Frozen expectations recorded from the approved October 14 contract; reconstructed and independently checked on view.
export const R1_STUDY = {
  "version": "r1-study-v1",
  "inputDigest": "2bc265dfd8ce8c1b99a6de15a04ba8bf2af091dcaa0a89afa7c7eaae9ac9203e",
  "records": {
    "reactive": {
      "digest": "43c92491189cdb64eea6c5483488374a00399e155f6b61475bce093d449ec17a",
      "eventsDigest": "b2fd0bf4f227977398da91f2a87fb8eb634c656bd49c41e414b747cb0d0a2a71",
      "metrics": {
        "pending": 0,
        "assigned": 0,
        "picked_up": 5,
        "completed": 132,
        "expired": 26,
        "admitted": 163,
        "served": 137,
        "service_rate": {
          "n": 137,
          "d": 163
        },
        "empty_m": {
          "n": 59400,
          "d": 1
        },
        "pickup_m": {
          "n": 27400,
          "d": 1
        },
        "rebalancing_m": {
          "n": 32000,
          "d": 1
        },
        "passenger_m": {
          "n": 270300,
          "d": 1
        },
        "deadhead_ratio": {
          "n": 198,
          "d": 1099
        },
        "wait": {
          "A": {
            "n": 33,
            "median": 60,
            "p95": 360,
            "unserved": 8,
            "pending": 0
          },
          "B": {
            "n": 38,
            "median": 60,
            "p95": 60,
            "unserved": 0,
            "pending": 0
          },
          "C": {
            "n": 29,
            "median": 60,
            "p95": 240,
            "unserved": 13,
            "pending": 0
          },
          "D": {
            "n": 37,
            "median": 60,
            "p95": 240,
            "unserved": 5,
            "pending": 0
          }
        }
      }
    },
    "forecast": {
      "digest": "30543a2352d3e826e9f82ce61fe82d07b5e9cf01dc92b019582e1df4bf977f89",
      "eventsDigest": "332f0489d32eb05b89d4b3c0d1ffccf34316fa623cd5d2123755d33d4886f084",
      "metrics": {
        "pending": 0,
        "assigned": 0,
        "picked_up": 6,
        "completed": 145,
        "expired": 12,
        "admitted": 163,
        "served": 151,
        "service_rate": {
          "n": 151,
          "d": 163
        },
        "empty_m": {
          "n": 92200,
          "d": 1
        },
        "pickup_m": {
          "n": 30200,
          "d": 1
        },
        "rebalancing_m": {
          "n": 62000,
          "d": 1
        },
        "passenger_m": {
          "n": 297000,
          "d": 1
        },
        "deadhead_ratio": {
          "n": 461,
          "d": 1946
        },
        "wait": {
          "A": {
            "n": 39,
            "median": 60,
            "p95": 360,
            "unserved": 2,
            "pending": 0
          },
          "B": {
            "n": 38,
            "median": 60,
            "p95": 258,
            "unserved": 0,
            "pending": 0
          },
          "C": {
            "n": 36,
            "median": 60,
            "p95": 240,
            "unserved": 6,
            "pending": 0
          },
          "D": {
            "n": 38,
            "median": 60,
            "p95": 180,
            "unserved": 4,
            "pending": 0
          }
        }
      }
    }
  }
};
