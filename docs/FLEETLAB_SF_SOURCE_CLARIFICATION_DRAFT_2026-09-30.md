# SF boundary source — clarification draft

30 September 2026. **Unsent draft.** No message has been sent to the City or
any source owner. This packages the exact unresolved source question so the
owner can request a decision without reconstructing the research.

## Ready-to-send text

Subject: Reuse terms and authoritative untrimmed 2022 supervisorial boundaries

Hello DataSF / San Francisco GIS team,

I am building a public educational fleet-simulation site. It uses synthetic
operations and does not claim navigation, operator affiliation or real-world
vehicle-safety validation.

The [DataSF 2022 district dataset](https://data.sf.gov/d/f2zs-jevy) links to
the [official final-map application](https://sfgov.maps.arcgis.com/apps/webappviewer/index.html?id=57159538a9a3422a9d22ef75d66565b6).
Its “Final Map April 28 2022” layer refers to item
`6c8455aa3abb4c33a8c78001d25ccf5b` and the following
[feature service](https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/Proposed_Final_Map_04_25_22_SHP/FeatureServer/0).

The full service includes water areas omitted from the trimmed DataSF layer.
That distinction affects attribution of road portions around bridges and municipal
borders. The feature-service item's license and attribution fields are empty.

Could you clarify:

1. Which reuse license applies to this exact full geometry? Does it permit
   redistribution of the downloaded GeoJSON and derived road-to-district
   reporting in a public educational website, and what attribution is required?
2. Is this the authoritative adopted April 2022 district geometry, despite
   “Proposed” in its internal service name? Is there a newer authoritative
   untrimmed district dataset with explicit reuse terms?
3. Should the full geometry be used for administrative reporting of bridge and
   border-road context, or is another authoritative source recommended?

I will retain exact source URLs, capture dates and digests, disclose uncertainty,
and keep administrative boundaries separate from synthetic service-area assumptions.

Thank you,
Bo-Huei Lin

## Evidence accompanying the request

- Captured full GeoJSON SHA-256:
  `085cde730a5bd725d6c87234a5326c1d22c4a0f20a9147c24c24c9b822fb3c26`.
- Full inventory comparison: 49 remaining differences / 441.926 m; no roads or
  requests removed. Exact administrative report and exception worksheet are
  documented in [the implementation handoff](FLEETLAB_SF_ADMINISTRATIVE_REPORT_2026-09-30.md).
- The City's [2019 data policy](https://media.api.sf.gov/documents/Data_Policy_APPROVED_1.17.2019_0.pdf)
  connects its Open Data definition to publication on the City's open-data
  portal (§2.0), and sets PDDL as the default with possible approved exceptions
  (§2.2.5). This is why a default policy alone has not been treated as a proven
  grant for the separate ArcGIS layer.
- [DataSF terms](https://data.sf.gov/terms-of-use) define data available through
  DataSF and permit dataset-specific conditions; they do not independently
  resolve this layer's missing license metadata. This is an evidence gap,
  not a conclusion that reuse is prohibited.

The source response should be retained with the exact dataset identity and any
applicable terms. A license clarification would resolve rights evidence; it
would not replace the administrative adoption decision, boundary review or
independent map/device/visitor observations.

**Recommendation:** ask for a dataset-specific clarification or a clearly
licensed authoritative alternative; keep the full geometry local meanwhile.

**Top risks + mitigations:** do not transfer the trimmed layer's license to a
different dataset or imply that a public URL establishes reuse rights. Preserve
the source chain and the unanswered question explicitly.

**Next 3 actions:** obtain the source response; bind it to a new immutable
source/adoption record; resolve the corresponding exception worksheet before
publishing or changing qualification.
