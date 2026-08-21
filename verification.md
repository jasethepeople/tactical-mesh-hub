# Browser Verification Notes

The live preview was opened at the managed development URL. The callsign was changed to `ECHO-7`; the map label changed immediately, confirming identity control wiring. A high-priority emergency alert, `MEDICAL SUPPORT REQUIRED AT SECTOR 4`, was transmitted while no peers were present. The dashboard recorded one alert, displayed a `QUEUED` delivery state, and increased the gossip queue to one pending item.

The desktop and mobile visual checks show the high-contrast tactical dashboard, topology graph, communications board, logistics form, IndexedDB footer status, and low-bandwidth control. The initial logistics button interaction was obscured by the preview chrome, so the visible resource action was invoked directly through the live document. The board then displayed one `WATER RATIONS` supply record with `AVAILABLE` status and the logistics counter increased to one.

Low-bandwidth mode was enabled in the live dashboard. The topology label changed to `REFRESH / 5.0S`, the map showed `LOW-BW / COMPACT`, and the payload telemetry changed from `STANDARD` to `COMPACT`.

The encrypted export flow was exercised with a temporary test passphrase. The browser reported `Encrypted state archive exported. Store its passphrase separately.` and cleared the passphrase field after producing the local JSON download.

The live preview was then reloaded. The callsign `ECHO-7`, queued alert, `WATER RATIONS` logistics record, low-bandwidth setting, and compact refresh mode all remained present, confirming browser-local persistence across a real page reload.
