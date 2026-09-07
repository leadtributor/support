# Bestands-Leads auf Leadquelle und Kampagne migrieren

Der **Lead-Performance-Report** wertet Ihre Leads nach **Leadquelle** und **Kampagne**
aus — vom Volumen über die Abschlussquote bis zur Bewertung durch Ihre
Vertriebspartner. Grundlage sind zwei Feldtypen, die Sie über den Formular-Editor in
Ihr Lead-Formular aufnehmen. Ihre vorhandenen Leads kennen diese Felder naturgemäß
noch nicht: Sie erscheinen im Report gesammelt in der Zeile **„Ohne Angabe"**.

Dieser Leitfaden beschreibt, wie Sie Ihren Bestand nachziehen. Der erste Teil
vergleicht die möglichen Wege und die technischen Grundlagen — er gilt unabhängig
davon, mit welchem Werkzeug Sie arbeiten. Der zweite Teil zeigt konkret, wie die
Migration mit dem beigelegten Rahmen-Skript `index.mjs` abläuft.

> 🇬🇧 An English version of this guide is available in
> [README.en.md](README.en.md).

## Voraussetzungen

1. Die Felder **Leadquelle** und **Kampagne** sind in Ihrem Lead-Formular angelegt.
   Beide sind Auswahlfelder mit festen Werten — der Report gruppiert dadurch sauber,
   statt an Schreibvarianten zu scheitern.
2. Ein **API-Key** für die Umgebung, in der Sie migrieren. Keys erstellen Sie in der
   Anwendung unter **Einstellungen → Konnektoren**:
   - Live: <https://leadtributor.cloud/#/settings/connectors>
   - Demo: <https://demo.leadtributor.cloud/#/settings/connectors>

   Ein Live-Key authentifiziert ausschließlich gegen die Live-API, ein Demo-Key
   ausschließlich gegen die Demo-API.
3. Für das Rahmen-Skript zusätzlich: **Node.js 18 oder neuer**.

## Welcher Weg passt zu Ihrem Bestand?

Wie Sie mit dem Bestand umgehen, hängt von Ihrer Leadmenge und Ihrem Anspruch an die
Auswertung ab. Trennen Sie dabei zwei Fragen: **Wie kommen die Werte in die Leads?**
Darauf antworten die fünf Strategien unten. Und: **Woher kommen die Werte
überhaupt?** Aus Regeln, die Sie formulieren können — oder aus dem Wissen Ihres
Fachbereichs, das Sie über einen
[CSV-Roundtrip](#hilfsmittel-der-csv-roundtrip-mit-ihrem-fachbereich) einsammeln.

Die folgenden Strategien haben sich bewährt — und lassen sich kombinieren.

**1. Stichtags-Strategie (der einfachste Weg).** Nehmen Sie die Felder in Ihr
Formular auf und pflegen Sie die Werte konsequent ab einem Stichtag. Der Bestand
bleibt, wie er ist, und läuft im Report unter „Ohne Angabe" mit. Stellen Sie parallel
Ihre Lead-Eingänge um — Webformulare, Landingpages und Integrationen liefern die
neuen Felder ab sofort mit. So wächst der unklassifizierte Bestand nicht weiter, egal
für welche der übrigen Strategien Sie sich entscheiden. *Tipp:* Wählen Sie im Report
einen Auswertungszeitraum ab Ihrem Stichtag — dann vergleichen Sie ausschließlich
vollständig gepflegte Leads.

**2. Manuelle Nachpflege.** Bei einer überschaubaren Anzahl an Bestands-Leads
ergänzen Sie Quelle und Kampagne direkt auf der Lead-Seite; nach dem Aktualisieren
Ihres Formulars stehen die Felder dort bereit. Sind es zu viele für ein komplettes
Nacharbeiten, genügt es häufig, offene bzw. aktive Leads und die der letzten Monate
nachzupflegen. Um ein großes Migrationsprojekt zu vermeiden, können Ihre Bearbeiter
die Felder immer dann ergänzen, wenn ein Bestands-Lead ohnehin angefasst wird — der
aktive Bestand vervollständigt sich so Stück für Stück von selbst.

**3. Automatisierung mit Zapier oder n8n.** Lässt sich Quelle oder Kampagne aus
vorhandenen Daten ableiten — etwa aus einem bisherigen Freitextfeld, dem
Herkunftssystem (nutzen Sie individuelle API-Keys für unterschiedliche
API-Konsumenten?) oder Kampagnen-Parametern —, lesen Sie Ihre Leads über die
Integration aus, ordnen die Werte per Regel zu und schreiben sie automatisch zurück.
Die Regeln aus [Technische Grundlagen](#technische-grundlagen-migration-über-die-public-api)
gelten dabei genauso wie für ein eigenes Skript.

**4. Eigene Migration über die Public API.** Für größere Bestände ist das
Rahmen-Skript in diesem Ordner gedacht: Sie passen eine Funktion an Ihre Daten an,
prüfen den Probelauf und lassen es dann schreiben. Der Rest dieses Leitfadens
beschreibt genau diesen Weg.

**5. Migration durch das leadtributor-Team.** Auf Wunsch übernehmen wir die Migration
Ihrer Bestands-Leads für Sie (nach individueller und vertraglicher Abstimmung).
Sprechen Sie unseren Support an — gemeinsam finden wir den Weg, der zu Ihrem Bestand
passt.

### Hilfsmittel: der CSV-Roundtrip mit Ihrem Fachbereich

Der CSV-Roundtrip ist keine eigene Strategie, sondern das Mittel, mit dem Sie die
Strategien 3 und 4 füttern, wenn sich die Zuordnung **nicht** in Regeln fassen lässt:
Exportieren Sie Ihre Leads als CSV und lassen Sie Marketing oder Vertrieb Quelle und
Kampagne in Excel ergänzen — dort sitzt das Wissen, welcher Lead zu welcher Kampagne
gehörte. Die angereicherte Datei spielen Sie anschließend automatisiert zurück, über
Ihre Automatisierungsplattform oder das Rahmen-Skript (siehe
[Strategie C](#strategie-c--werte-aus-einer-csv-übernehmen)).

So trennen Sie sauber: Fachwissen in Excel, Technik im Skript. Und Sie können
mischen — Regeln decken den Großteil ab, die CSV korrigiert die Fälle, die keiner
Regel folgen.

### Entscheidungshilfe

| Ausgangslage | Empfohlener Weg |
| --- | --- |
| Historie ist für die Auswertung nicht relevant | Stichtag (1) |
| Wenige hundert Leads, Wissen bei den Bearbeitern | Manuelle Nachpflege (2) |
| Zuordnung folgt Regeln (Feld, Zeitraum, Quellsystem) | Automatisierung (3) oder Skript (4) |
| Zuordnung steckt in Köpfen, viele Leads | Automatisierung (3) oder Skript (4), gefüttert per CSV-Roundtrip |
| Sehr großer Bestand, keine eigenen Entwicklerkapazitäten | Migration durch leadtributor (5) |

Kurz gesagt: Sie müssen nicht alles auf einmal lösen. Schon mit der
Stichtags-Strategie liefert der Report vom ersten Tag an belastbare Aussagen über
Ihre neuen Leads.

## Technische Grundlagen: Migration über die Public API

Die folgenden Regeln gelten für **jede** technische Migration — ob Sie das
Rahmen-Skript nutzen, in Zapier/n8n modellieren oder selbst implementieren.

### Authentifizierung und Umgebung

Der API-Key wird **ohne Schema-Präfix** im `Authorization`-Header gesendet — kein
`Bearer`, kein `ApiKey`:

```
Authorization: <api-key>
```

Base-URLs:

| Umgebung | Base-URL |
| --- | --- |
| Live | `https://api.leadtributor.cloud` |
| Demo | `https://api.demo.leadtributor.cloud` |

Beide Umgebungen sind vollständig getrennt — Accounts, Daten und Keys wechseln nicht
über. Wenn Sie in Demo einen vergleichbaren Datenstand haben, üben Sie Ihre Migration
zuerst dort.

### Leads lesen

`GET /leads` liefert die Leads Ihres Unternehmens in Seiten. Die Iteration läuft über
ein **Continuation-Token**, das jede Antwort im Response-Header `x-continuation`
mitgibt: Sie hängen es an die nächste, sonst unveränderte Anfrage an und sind fertig,
wenn ein leeres Ergebnis kommt.

Die Listenantwort enthält nicht alle Felder eines Leads. Für die Feldlisten (und damit
für die Prüfung, ob Leadquelle/Kampagne bereits gefüllt sind) holen Sie den Lead
einzeln über `GET /leads/{leadId}`.

### Werte schreiben

Geschrieben wird mit `PATCH /leads/{leadId}`. Zwei Eigenschaften sind entscheidend:

- **Feldlisten werden als Ganzes ersetzt.** Es werden nur die Feldlisten geändert,
  die im Request Body stehen — eine enthaltene Liste wird aber vollständig
  überschrieben. Sie senden also immer die **komplette** `interest`-Liste des Leads
  (alle bestehenden Felder plus die neuen Werte). Wer nur die zwei neuen Felder
  sendet, löscht alle anderen `interest`-Felder des Leads.
- **Die neuen Werte werden als `text:singleline` geschrieben.** Die Auswahllisten-Semantik
  (Feldtypen `text:list:leadsource` / `text:list:campaign`) lebt in der Formular-Definition
  und wirkt bei der Anzeige — am Lead wird jeder einwertige Listen-Wert als einfacher
  String gespeichert. Requests, die stattdessen den Listentyp mit einem einelementigen
  Array deklarieren, akzeptiert die API weiterhin und speichert sie in derselben Form.

```json
{
  "interest": {
    "fields": {
      "…Ihre bestehenden Felder…": { "type": "text:singleline", "value": "…" },
      "Leadquelle": { "type": "text:singleline", "value": "Website" },
      "Kampagne":   { "type": "text:singleline", "value": "Frühjahrsaktion 2026" }
    }
  }
}
```

Die Schlüssel in `fields` sind die **Feld-Labels aus Ihrem Formular**, keine
technischen IDs. Heißt Ihr Feld „Lead source", muss im Request genau das stehen.

### Idempotenz und Tempo

Zwei Prinzipien machen eine Migration wiederholbar und unkritisch:

- **Nie überschreiben.** Prüfen Sie vor dem Schreiben, ob im Zielfeld schon ein Wert
  steht, und überspringen Sie den Lead dann. So können Sie den Lauf beliebig oft
  wiederholen — nach einem Abbruch oder nachdem Sie Ihre Regeln verfeinert haben.
- **Sequenziell mit kleiner Pause.** Verarbeiten Sie Leads nacheinander mit einer
  kurzen Verzögerung, statt zu parallelisieren. Das bleibt auch bei großen Beständen
  weit unter den Rate-Limits der API.

## Das Rahmen-Skript

`index.mjs` in diesem Ordner ist ein **Rahmen-Skript**, kein fertiges
Migrationsprogramm: Es bringt die komplette Mechanik mit (Paginierung, Idempotenz,
korrektes Zusammenbauen der Feldliste, Wiederholungen, Probelauf) und lässt genau die
eine Stelle offen, die nur Sie kennen — **welcher Lead welchen Wert bekommt**.

### Installation

```bash
npm install        # oder: npm ci  (reproduzierbar, nutzt die package-lock.json)
```

Einzige Abhängigkeit ist `axios`. Es sind keine Datenbankzugänge, VPN-Verbindungen
oder AWS-Credentials nötig — das Skript spricht ausschließlich HTTPS gegen die
Public API.

### Konfiguration über Environment-Variablen

Das Skript kennt **keine Kommandozeilen-Parameter**. Alles läuft über das
Environment:

| Variable | Default | Wirkung |
| --- | --- | --- |
| `API_KEY` | *leer* | Ihr API-Key. Wird nicht validiert — ohne Key scheitert der erste Aufruf mit einem Authentifizierungsfehler (`401`/`403`). |
| `DRY_RUN` | `true` | Schreibschutz. **Nur exakt `DRY_RUN=false` schreibt**; `0`, `no` oder `FALSE` bleiben ein Probelauf. |
| `LEADTRIBUTOR_URL` | `https://api.leadtributor.cloud` | Ziel-API. Für Probeläufe auf `https://api.demo.leadtributor.cloud` setzen. |
| `CSV_FILE` | *nicht gesetzt* | Pfad zur Mapping-CSV; aktiviert Strategie C. |
| `OVERWRITE` | `false` | Nur mit `OVERWRITE=true`: ersetzt auch bereits vorhandene Werte — und zwar nur dort, wo sich der Wert tatsächlich unterscheidet. Zum Korrigieren falscher Werte aus einem früheren Lauf. |
| `FIELD_LIST` | `interest` | Feldliste, die die Zielfelder trägt: `interest` (Anfrage-Block) oder `prospect` (Kontakt-Block). |
| `LEADSOURCE_FIELD` / `CAMPAIGN_FIELD` | `Leadquelle` / `Kampagne` | Überschreiben die Feld-Labels aus dem Skript, ohne die Datei zu bearbeiten. |

Beachten Sie den Default von `LEADTRIBUTOR_URL`: **ohne weitere Angabe läuft das
Skript gegen Live.**

### Aufbau des Skripts

Die Datei ist bewusst in zwei Zonen geteilt:

- **`CUSTOMIZE HERE`** — die Feld-Labels, eine optionale Mapping-Tabelle und die
  Strategien. Nur hier arbeiten Sie.
- **Generic plumbing** — Paginierung, Feldlisten-Merge, Retry, Zähler und Ausgaben.
  Hier ist keine Änderung nötig.

Die Ziel-Labels stehen direkt oben und müssen exakt den Feldern in *Ihrem* Formular
entsprechen. `TARGET_FIELD_LIST` bestimmt, in welcher der beiden Feldlisten diese
Felder liegen — `interest` (Anfrage-Block) oder `prospect` (Kontakt-Block); im
Zweifel schauen Sie im Formular-Editor nach, in welchem Block das Feld steht:

```js
const LEADSOURCE_FIELD = process.env['LEADSOURCE_FIELD'] || 'Leadquelle';
const CAMPAIGN_FIELD = process.env['CAMPAIGN_FIELD'] || 'Kampagne';
const TARGET_FIELD_LIST = process.env['FIELD_LIST'] || 'interest';
```

Alle drei lassen sich auch per Umgebungsvariable setzen, wenn Sie die Datei nicht
anfassen möchten.

Optional normalisiert eine Mapping-Tabelle Freitext-Schreibweisen auf Ihre
kanonischen Werte. Die Schlüssel werden **ohne Rücksicht auf Groß-/Kleinschreibung**
gematcht; nicht gemappte Werte gehen unverändert durch:

```js
const VALUE_MAP = {
    'website': 'Website',
    'web': 'Website',
    'google': 'Google Ads',
    'messe': 'Messe',
};
```

## Die drei Wertequellen im Skript

Innerhalb des Skripts geht es nur noch um die Frage, **woher der Wert für einen Lead
kommt**. Dafür bringt es drei Bausteine mit — im Code `Strategy A`, `B` und `C`
genannt. Jeder ist eine Funktion, die für einen Lead entweder ein Objekt mit
`leadSource` und/oder `campaign` zurückgibt — oder `null`, wenn der Lead unangetastet
bleiben soll.

### Strategie A — Kopieren aus einem bestehenden Feld

Für den Fall, dass Ihr Formular die Information schon trägt, etwa in einem
Freitextfeld `Quelle` (Typ `text:singleline`):

```js
function copyFromExistingField(lead) {
    const raw = lead.interest?.fields?.['Quelle']?.value;   // <-- Ihr bestehendes Feld
    if (!raw || typeof raw !== 'string' || raw.trim() === '') return null;
    return { leadSource: normalize(raw) };                  // oder: { campaign: normalize(raw) }
}
```

Anzupassen sind der Feldname und das Zielfeld. **Achtung bei Auswahlfeldern als
Quelle:** Deren `value` ist ein *Array*, kein String — der `typeof`-Test greift dann
und es passiert nichts. Nutzen Sie in diesem Fall die mitgelieferte Hilfsfunktion
`currentValue(lead.interest, 'Quelle')`, die Arrays auf ihr erstes Element
reduziert.

### Strategie B — Ableiten per Regel

Für den Fall, dass der Wert nirgends gespeichert ist, sich aber erschließen lässt —
etwa „alles, was während der Frühjahrsaktion entstand, gehört dazu":

```js
function deriveFromCreatedAt(lead) {
    const createdAt = new Date(lead.createdAt);
    if (createdAt >= new Date('2026-03-01') && createdAt < new Date('2026-06-01')) {
        return { leadSource: 'Google Ads', campaign: 'Frühjahrsaktion 2026' };
    }
    return null;
}
```

`lead.createdAt` ist ein ISO-Zeitstempel; alle Formularfelder stehen über
`lead.prospect.fields` und `lead.interest.fields` zur Verfügung. Sie können also auch
nach Region, Produktinteresse oder Herkunftssystem verzweigen.

### Strategie C — Werte aus einer CSV übernehmen

Das technische Ende des
[CSV-Roundtrips](#hilfsmittel-der-csv-roundtrip-mit-ihrem-fachbereich): Die in Excel
angereicherte Datei wird einmalig beim Start eingelesen, pro Lead wird dann nur noch
in der Tabelle nachgesehen.

```js
const CSV_FILE = process.env['CSV_FILE'] || null;
const csvMapping = CSV_FILE ? loadCsvMapping(CSV_FILE) : null;

function mapFromCsvFile(lead) {
    return csvMapping?.get(lead.leadId) ?? null;
}
```

An dieser Funktion ist nichts anzupassen — Sie liefern nur die Datei.

### Wertequellen kombinieren

`deriveValues` bündelt die Bausteine. Später aufgeführte Einträge gewinnen pro
Eigenschaft:

```js
function deriveValues(lead) {
    return {
        ...deriveFromCreatedAt(lead),
        ...copyFromExistingField(lead),
        ...mapFromCsvFile(lead),
    };
}
```

In dieser Reihenfolge gilt also **CSV > bestehendes Feld > Regel** — ein bewährtes
Muster: Regeln als Basis, die CSV als manuelle Korrekturschicht darüber. Nicht
benötigte Bausteine entfernen Sie einfach aus der Liste.

Die Rückgabe steuert auch den **Umfang** der Migration: Wer nur einen Teil des
Bestands anfassen will, gibt für alles andere `null` bzw. `{}` zurück. Genau so
machen Sie auch einen **Pilotlauf** auf wenigen Leads — etwa indem Sie zusätzlich auf
eine Handvoll `leadId`s einschränken.

## Das CSV-Format

Eine **semikolongetrennte** Datei mit Kopfzeile und den Spalten `leadId`,
`leadSource` und/oder `campaign`:

```csv
leadId;leadSource;campaign
161fe19f-a23d-45cb-8895-41b0bf9f3100;Website;Frühjahrsaktion 2026
0b2f…;Messe;
```

- Die **Kopfzeile ist Pflicht**, die Spaltenreihenfolge ist frei. Es müssen `leadId`
  und mindestens eine der beiden Wertespalten vorkommen, sonst bricht das Skript
  sofort mit einer Meldung ab.
- **Leere Zellen werden ignoriert** — im Beispiel oben bekommt der zweite Lead nur
  eine Leadquelle, seine Kampagne bleibt unberührt.
- Zeilen ohne `leadId` werden übersprungen.
- Der Parser ist absichtlich minimal und kennt **kein CSV-Quoting**: Werte dürfen
  kein Semikolon enthalten. Excel-Exporte mit deutschem Gebietsschema
  („CSV Trennzeichen-getrennt") passen; bei Kampagnennamen mit Semikolon müssen Sie
  vorher bereinigen.

## Durchführung Schritt für Schritt

1. **Vorbereiten.** Felder im Formular anlegen, API-Key erzeugen, `npm install`
   ausführen.
2. **Bestand sichern.** Das Skript hat **kein Rollback**. Ziehen Sie vorher einen
   vollständigen Lead-Export (etwa über den Lead-Export der Anwendung oder das
   Beispiel `list_all_leads` im
   [examples-Repository](https://github.com/leadtributor/examples)), damit Sie die
   Ausgangswerte belegen können.
3. **Anpassen.** Im `CUSTOMIZE HERE`-Block die Feld-Labels setzen, Strategie(n)
   wählen und in `deriveValues` verdrahten, optional `VALUE_MAP` füllen.
4. **Probelauf, idealerweise gegen Demo.** Der Dry-Run ist Standard, es wird nichts
   geschrieben:

   ```bash
   API_KEY=<ihr-demo-api-key> LEADTRIBUTOR_URL=https://api.demo.leadtributor.cloud \
     node index.mjs
   ```

5. **Probelauf gegen Live** — ebenfalls ohne Schreibzugriff, und diesmal mit
   protokollierter Ausgabe. Der Dry-Run-Bericht ist Ihr einziger Nachweis darüber,
   was gleich verändert wird:

   ```bash
   API_KEY=<ihr-api-key> node index.mjs | tee migration-dryrun.log
   ```

6. **Ausgabe prüfen.** Stichproben aus den `WOULD update …`-Zeilen mit dem Lead in
   der Anwendung vergleichen. Passt die Trefferzahl zu Ihrer Erwartung? Sind
   `skipped`- und `failed`-Zahlen plausibel?
7. **Live-Lauf.**

   ```bash
   API_KEY=<ihr-api-key> DRY_RUN=false node index.mjs | tee migration-live.log
   ```

8. **Ergebnis kontrollieren.** Im Lead-Performance-Report einen Zeitraum wählen, der
   den migrierten Bestand abdeckt — die Zeile „Ohne Angabe" muss deutlich kleiner
   geworden sein.
9. **Nacharbeiten.** Regeln verfeinern und erneut laufen lassen: Bereits gefüllte
   Felder bleiben unangetastet, der Lauf füllt nur die Lücken.

Beim CSV-Roundtrip kommt in Schritt 4/5/7 jeweils `CSV_FILE` hinzu:

```bash
API_KEY=<ihr-api-key> CSV_FILE=./mapping.csv node index.mjs
```

### Falsche Werte korrigieren

Hat ein Lauf einen falschen Wert geschrieben — etwa aus einer CSV mit vertauschten
Spalten —, kommt ein neuer Lauf nicht dagegen an: das Feld ist nicht mehr leer und
wird geschützt. Jeder so geschützte Wert wird protokolliert:

```
KEEPING existing on lead <leadId>: leadSource 'Google Ads' kept, mapping proposed 'Google'
```

Diese Zeilen sind zugleich der Nachweis, dass nichts überschrieben wurde, und zeigen, wo Ihre
Mapping-Tabelle den bereits gepflegten Werten widerspricht. Die Abschlusszeile zählt sie.
Wollen Sie diese Werte *doch* ersetzen, gibt es `OVERWRITE=true`. Ersetzt wird dann nur, wo
sich der Wert tatsächlich unterscheidet; die Ausgabe zeigt den Austausch als
`campaign='alt' -> 'neu'`. Erst im Dry-Run prüfen:

```bash
API_KEY=<ihr-api-key> CSV_FILE=./mapping.csv OVERWRITE=true node index.mjs
```

## Die Ausgaben verstehen

| Ausgabe | Bedeutung |
| --- | --- |
| `Loaded 42 mappings from ./mapping.csv` | CSV eingelesen — Kontrolle, ob die Datei erkannt wurde. |
| `Migrating leads on … (DRY RUN — nothing will be written)` | Probelauf. Bei `(LIVE RUN)` wird geschrieben. |
| `WOULD update lead <id> (created …): leadSource='…', campaign='…'` | Geplante Änderung im Probelauf; im Live-Lauf `Updating lead …`. |
| `FAILED lead <id>: 403 …` | Dieser Lead wurde übersprungen, der Lauf geht weiter. |
| `... 100 leads processed` | Fortschritt, alle 100 Leads. |
| `Done. 1234 processed, 87 would be updated, 1147 skipped …, 0 failed.` | Abschlussbilanz. |

`skipped` fasst zwei Fälle zusammen: Ihre Strategie hat keinen Wert geliefert **oder**
das Zielfeld war bereits gefüllt. Eine hohe `skipped`-Zahl im ersten Probelauf ist
also normal — sie ist erst dann ein Signal, wenn Sie mehr Treffer erwartet hatten.

Genauso erklärt sich, wenn eine Zeile nur *eines* der beiden Felder zeigt, obwohl Ihre
CSV beide liefert: das andere Feld war bereits gefüllt und bleibt geschützt. Ob der
vorhandene Wert stimmt, prüfen Sie am Lead — korrigieren lässt er sich mit
`OVERWRITE=true` (siehe [Falsche Werte korrigieren](#falsche-werte-korrigieren)).

Als Tempo können Sie mit etwa **4–5 Leads pro Sekunde** rechnen: Pro Lead fallen zwei
API-Aufrufe plus eine Pause von 100 ms an. 10.000 Leads brauchen damit gut eine
halbe Stunde — pro Lauf, also auch für den Probelauf.

## Grenzen und Vorsichtsmaßnahmen

- **Kein Backup, kein Rollback.** Das Skript kann Änderungen nicht zurücknehmen.
  Export vorher, Dry-Run-Protokoll aufbewahren.
- **Der Default ist Live.** Ohne `LEADTRIBUTOR_URL` läuft das Skript gegen die
  Produktivumgebung. Für Probeläufe bewusst umstellen.
- **Kein eingebautes Limit und kein Filter.** Das Skript geht immer über *alle* Leads
  Ihres Accounts. Der Umfang wird ausschließlich in `deriveValues` begrenzt.
- **„Wiederholbar" heißt: von vorn.** Es gibt keinen gespeicherten Fortschritt. Nach
  einem Abbruch startet der nächste Lauf wieder beim ersten Lead — dank Idempotenz
  ohne Schaden, aber mit der gleichen Laufzeit.
- **Kein strukturiertes Protokoll.** Ausgaben gehen auf stdout/stderr. Wer ein
  Audit-Trail braucht, leitet sie in eine Datei um (siehe `tee` oben).
- **Wiederholungen nur bei `429` und `5xx`.** Bei diesen Antworten versucht es das
  Skript bis zu drei Mal mit wachsender Pause. Andere Fehler (400, 403, 404) und
  abgebrochene Verbindungen werden nicht wiederholt, sondern als `FAILED` gezählt.

## Troubleshooting

| Symptom | Ursache und Abhilfe |
| --- | --- |
| Sofortiger Abbruch beim ersten Aufruf, `401`/`403` | `API_KEY` fehlt, ist ungültig oder gehört zur anderen Umgebung (Live-Key gegen Demo-API oder umgekehrt). |
| Alle Leads `FAILED` mit `403` beim `PATCH` | Der Key hat keine Schreibrechte, oder die Leads gehören nicht Ihrem Unternehmen. |
| Einzelne Leads `FAILED` mit `400` | Feld-Label stimmt nicht mit dem Formular überein, oder es sollte mehr als ein Wert geschrieben werden. `LEADSOURCE_FIELD`/`CAMPAIGN_FIELD` prüfen. Lautet die Meldung `Invalid request body`, hat die API den Body abgelehnt, bevor er den Dienst erreichte — dann mit `LOG_PAYLOAD_ON_ERROR=true` den gesendeten Payload ansehen. |
| Alles `skipped`, obwohl die Zielfelder leer sind | Die Zielfelder liegen in der anderen Feldliste — `FIELD_LIST` auf `prospect` bzw. `interest` umstellen. |
| Alles `skipped`, keine `WOULD update`-Zeile | Die Strategie liefert nichts: falscher Quellfeldname, Zeitfenster passt nicht, oder das Quellfeld ist ein Auswahlfeld (Array) — dann `currentValue()` nutzen. |
| Ein Feld wird nicht gesetzt, obwohl die CSV einen Wert dafür hat | Das Zielfeld ist bereits gefüllt und wird deshalb geschützt — auch wenn der vorhandene Wert falsch ist. Mit `OVERWRITE=true` korrigieren. |
| Weniger Leads verarbeitet als im Account vorhanden | Vergleichen Sie die `processed`-Zahl mit der Gesamtzahl im `X-Total`-Header von `GET /leads`. Bei einer Abweichung den Lauf wiederholen — dank Idempotenz füllt er die verbliebenen Lücken. |
| `expected a header row with 'leadId' …` | Die CSV hat keine Kopfzeile, andere Spaltennamen oder ein anderes Trennzeichen als `;`. |
| Werte landen zerschnitten in den Feldern | Semikolon im CSV-Wert. Der Parser kennt kein Quoting — Werte bereinigen. |
| Die Zahlen im Report ändern sich nicht | Falscher Auswertungszeitraum: der Report gruppiert nach **Erstellungsdatum** der Leads, nicht nach dem Migrationszeitpunkt. |

## Hilfe

Sie sind mit dem Thema nicht allein: Auf Wunsch übernimmt das leadtributor-Team die
Migration Ihrer Bestands-Leads (nach individueller und vertraglicher Abstimmung).
Sprechen Sie einfach unseren Support an — gemeinsam finden wir den Weg, der zu Ihrem
Bestand passt.
