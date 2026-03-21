# Chrome Web Store Disclosures

Diese Vorlage ist auf den aktuellen Stand der Extension in diesem Repo abgestimmt.

## Alleiniger Zweck

BarryGuard hilft Nutzern dabei, Solana-Token auf unterstuetzten Websites direkt im Browser schneller auf Scam- und Risikosignale zu pruefen. Die Extension liest dazu auf unterstuetzten Seiten die Token-Adresse sowie oeffentlich sichtbare Token-Metadaten aus, fragt Risikoanalysen beim BarryGuard-Backend ab und zeigt die Ergebnisse im Overlay und im Popup an. Falls sich ein Nutzer anmeldet, zeigt die Extension zusaetzlich den aktiven Plan, verbleibende Nutzungsgrenzen und Account-bezogene Funktionen wie Upgrade oder Abo-Verwaltung an. BarryGuard ist als plattformuebergreifende Risikoebene fuer unterstuetzte Solana-Websites ausgelegt. Die aktuelle Version unterstuetzt Pump.fun, PumpSwap, Raydium, LetsBonk, Moonshot, Dexscreener, Birdeye und Solscan.

## Begruendung fuer `activeTab`

Nicht zutreffend fuer die aktuelle Version.

BarryGuard fordert `activeTab` in der aktuellen Version nicht mehr an. Die Extension arbeitet stattdessen mit eng begrenzten Hostberechtigungen fuer unterstuetzte Websites und mit lokal gebuendelten Content Scripts auf diesen explizit freigegebenen Domains.

## Begruendung fuer `storage`

BarryGuard verwendet `storage`, um lokal nutzerbezogene und funktionskritische Daten zu speichern. Dazu gehoeren insbesondere Login-Status, Auth-Token, das Nutzerprofil mit aktuellem Plan, lokal gecachte Token-Analysen, der zuletzt ausgewaehlte Token sowie lokale Nutzungszaehler fuer stundenbasierte Request-Limits. Ohne `storage` koennte die Extension keine Session aufrechterhalten, keine Account-Informationen anzeigen und keine performante, kontextbezogene Analyse bereitstellen.

## Begruendung fuer Hostberechtigung

BarryGuard benoetigt in der aktuellen Version Hostberechtigungen fuer:

- `https://pump.fun/*`
- `https://amm.pump.fun/*`
- `https://swap.pump.fun/*`
- `https://raydium.io/*`
- `https://letsbonk.fun/*`
- `https://bonk.fun/*`
- `https://moonshot.money/*`
- `https://dexscreener.com/*`
- `https://birdeye.so/*`
  BarryGuard liest auf diesen unterstuetzten Solana-Seiten die aktuell angezeigte Token-Adresse und oeffentlich sichtbare Token-Metadaten, um Risiko-Scores direkt im Seitenkontext anzuzeigen.
- `https://barryguard.com/*`
- `https://www.barryguard.com/*`
  BarryGuard kommuniziert mit dem BarryGuard-Backend fuer Risikoanalysen, Session-Validierung, Plan-Informationen sowie Login- und Account-Funktionen.

Die Hostberechtigungen werden ausschliesslich fuer den Funktionszweck der Extension verwendet. Wenn kuenftige Versionen weitere Websites unterstuetzen, werden Hostberechtigungen und Offenlegungen entsprechend erweitert.

## Wird Remote Code benoetigt?

Nein.

BarryGuard laedt und fuehrt keinen Remote Code aus. Alle ausfuehrbaren Skripte der Extension werden lokal mit dem Extension-Bundle ausgeliefert. Externe Verbindungen werden nur fuer API-Antworten, Account-Funktionen und das Laden externer Token-Bilder verwendet. Externe Daten oder Bilder werden nicht als ausfuehrbarer Code interpretiert oder ausgefuehrt.

## Datennutzung

Hinweis:
Die Antworten unten sind auf die aktuelle Implementierung bezogen. Wenn ihr spaeter weitere Plattformen, Tracking, Support-Chat oder neue Account-Felder hinzufuegt, muessen die Angaben aktualisiert werden.

### Welche Nutzerdaten werden jetzt oder in Zukunft erfasst?

#### Personenidentifizierbare Informationen

Ja.

BarryGuard verarbeitet bei Account-Nutzung insbesondere die E-Mail-Adresse und eine interne Nutzer-ID, um Login, Session und Plan-Zuordnung bereitzustellen.

#### Gesundheitsinformationen

Nein.

#### Finanzdaten und Zahlungsinformationen

Ja, eingeschraenkt.

BarryGuard verarbeitet bei zahlenden Nutzern plan- und abonnementsbezogene Daten wie Tier, Subscription-Status, Laufzeitende und einen Link zum Kundenportal. Die Extension verarbeitet keine Kreditkartennummern oder vollstaendigen Zahlungsdaten direkt in der Extension; Zahlungsabwicklung erfolgt ausserhalb der Extension ueber die BarryGuard-Website bzw. den dort eingebundenen Zahlungsanbieter.

#### Authentifizierungsdaten

Ja.

BarryGuard verarbeitet Login-Daten wie Passwort bei Login oder Registrierung sowie Auth-Token zur Sitzungsverwaltung. Auth-Token werden lokal gespeichert, damit die Session in der Extension erhalten bleibt.

#### Persoenliche Kommunikation

Nein.

#### Ort

Nein.

BarryGuard erhebt keine GPS-Daten oder sonstige praezise Standortdaten. Eine normale Server-Kommunikation kann technisch bedingt IP-Adressen im Rahmen des HTTP-Verkehrs auf Server-Seite beinhalten, die Extension selbst verwendet Standortdaten aber nicht als Produktfunktion.

#### Webprotokoll

Nein.

BarryGuard erstellt keine Liste der vom Nutzer besuchten Webseiten. Die Extension arbeitet nur auf unterstuetzten Seiten und verwendet den aktuellen Seitenkontext ausschliesslich, um die jeweils angezeigten Token zu analysieren.

#### Nutzeraktivitaet

Ja, eingeschraenkt.

BarryGuard verarbeitet nutzerbezogene Interaktionen, die fuer die Produktfunktion notwendig sind, zum Beispiel das Anklicken eines BarryGuard-Badges, die manuelle Eingabe einer Token-Adresse, Login-/Logout-Aktionen sowie den sichtbaren Token-Kontext auf unterstuetzten Seiten. Diese Daten werden nur fuer die unmittelbare Bereitstellung der Extension-Funktion genutzt.

#### Websitecontent

Ja.

BarryGuard verarbeitet auf unterstuetzten Seiten oeffentlich sichtbare Inhalte wie Token-Adressen, Tokennamen, Symbole, Logos und den jeweils angezeigten Seitenkontext, damit Risikoanalysen angezeigt und geoeffnete Tokens korrekt erkannt werden koennen.

## Bestaetigungen

Diese drei Punkte kannst du fuer die aktuelle Extension mit `Ja` bestaetigen:

- Ich verkaufe oder uebertrage keine Nutzerdaten an Dritte, ausser in den genehmigten Anwendungsfaellen.
- Nutzerdaten werden nicht aus Gruenden, die nichts mit dem alleinigen Zweck des Artikels zu tun haben, verwendet oder uebertragen.
- Nutzerdaten werden nicht zur Ermittlung der Kreditwuerdigkeit oder fuer Darlehenszwecke verwendet oder uebertragen.

## Praktischer Hinweis vor dem Store-Upload

Die aktuelle Chrome-Web-Store-Einreichung sollte widerspiegeln, dass `activeTab` von dieser Version nicht angefordert wird.
