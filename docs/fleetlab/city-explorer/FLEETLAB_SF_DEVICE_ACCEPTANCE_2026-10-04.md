# SF physical device and accessibility worksheet — 4 October 2026

Historical October 4 worksheet. See the [October 5 connected-Pixel record](FLEETLAB_SF_DEVICE_ACCEPTANCE_2026-10-05.md) for newer observations.

Status on October 4: **NOT_RUN**. `adb devices -l` on this date listed no device. Browser
emulation, DOM inspection and code tests are recorded separately in the
[release record](FLEETLAB_SF_CLARITY_RELEASE_2026-10-04.md). Prior permission to use
the Pixel is valid; this worksheet does not establish a connection or result.

Before testing, record: tester identifier/role; date/time/timezone; device model;
OS/browser versions; assistive technology/version; physical or emulated; viewport;
text/zoom settings; exact immutable URL and full release SHA from the release
record. Never substitute the moving stable URL without recording its version.
No account, location permission or personal data is required.

| Check | Procedure and expected observation | Result / evidence |
|---|---|---|
| Navigation | Open Overview, confirm animation controls, enter City Explorer, visit each section and return to Overview/catalog. Record any missing content. | NOT_RUN |
| Touch and map zoom | In City atlas, use each map version; pinch, pan and +/-; inspect a named road at close zoom. Depot controls and attribution remain separate and readable. | NOT_RUN |
| Selection | Switch A to A+B, select an EV story and another ID. Red squares match the chosen configuration; the summary identifies that recording. | NOT_RUN |
| Exact event seek | Original study, seed 1001, A, EV-001. Select the charging-port wait starting 09:36. Cursor says 09:36:29 and waiting; position sample says 09:36:15 / turnaround. This distinct sampled state is intentional. | NOT_RUN |
| Playback | Press Play directly, Pause, seek backward, use end-of-shift, then Play again. Confirm clock advances, pause holds, terminal shift is labeled and playback restarts. Repeat with A+B. Whole-shift totals stay fixed within a recording. | NOT_RUN |
| Portrait and landscape | Rotate during atlas and replay. No clipped labels or document-wide horizontal scroll; tables may scroll within their named region. Selection remains usable. | NOT_RUN |
| Enlarged text | Set browser text/zoom to 200% where supported and OS larger text. Read threshold, state/sample labels, depot controls and unavailable revenue. Record overflow and settings; do not count viewport resizing as text enlargement. | NOT_RUN |
| Keyboard | On desktop, Tab from skip link through navigation and controls; Enter/Space activate buttons; arrow/Home/End seek slider. Focus visible, ordered and not trapped. Check scrollable tables. | NOT_RUN |
| Screen reader | On Pixel with TalkBack, and desktop with available reader: traverse headings, labeled selects, time slider, Play/Pause, state/clock, trip summary, map alternative and limits. Record actual announced words and any repeated/unusable announcements. | NOT_RUN |
| Result understanding | Locate +1.11 pp, its interval and +2 pp threshold together; explain why map qualification is separate. Confirm stopped study estimate remains unavailable. | NOT_RUN |

For every row record PASS / FAIL / NOT_RUN, steps, actual observation, screenshot
or consented transcript reference, severity, assistance and issue ID. A screenshot
does not establish touch or screen-reader behavior. Preserve failures; retest a
changed release with both original and corrected evidence. Use anonymous labels;
do not capture notifications or unrelated device content.

Tester availability and physical Pixel connection are **pending**. Owner may
perform the worksheet manually and return results if a connection is unavailable;
remote automation is not a prerequisite for collecting honest human evidence.

**Recommendation:** run one physical Pixel session and one desktop keyboard /
screen-reader session on the release named in the release record.

**Top risks + mitigations:** treating emulation as device qualification → keep
method explicit; changing site during review → immutable release URL; inaccessible
dynamic labels → record actual assistive output, then fix and retest.

**Next 3 actions:** establish an observable Pixel connection or manual tester;
complete the rows with evidence; resolve issues before owner acceptance.
