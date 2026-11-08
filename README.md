# Teamboard

Ein Planungsboard für Teamleitungen: Themen auf einer Zeitleiste, Aufgaben mit Fristen (auch wiederkehrend), Abwesenheiten, Projekteinsätze und Punkte fürs nächste 1:1, dazu ein Verlauf mit allem, was erledigt ist. Läuft im Browser auf Rechner und Smartphone und lässt sich wie eine App installieren.

Deine Daten liegen in deinem eigenen privaten GitHub-Repository, verschlüsselt mit einem Passwort, das nur du kennst. Es gibt keinen Server und kein Konto beim Teamboard. Die App selbst ist eine statische Webseite aus diesem Repository.

**Ausprobieren ohne Einrichtung:** App öffnen und „Mit Beispieldaten ausprobieren“ wählen, oder `?demo=1` an die Adresse hängen. Nichts wird gespeichert.

## Einrichten

Du brauchst ein kostenloses GitHub-Konto. Die Einrichtungsseite der App führt dich durch drei Schritte, mit Links, die GitHub schon passend ausgefüllt öffnen.

1. **Privates Repository für deine Daten anlegen.** Name frei wählbar, zum Beispiel `teamboard-daten`, Sichtbarkeit „Private“. Mehr musst du dort nicht einstellen.
2. **Fine-grained Token erzeugen.** Der Link aus der App setzt Name, Laufzeit (ein Jahr) und die Berechtigung „Contents: Read and write“. Unter „Repository access“ wählst du „Only select repositories“ und dein Daten-Repository. Kopier den Token sofort und leg ihn in deinem Passwortmanager ab: GitHub zeigt ihn nur einmal, und du brauchst ihn auf jedem Gerät.
3. **Verbinden.** Token und ein Passwort für die Verschlüsselung eingeben. Das Repository erkennt die App am Token. Auf dem ersten Gerät gibst du das Passwort zweimal ein, dann legt die App die verschlüsselte Datei an.

Danach bietet die App einen kurzen Rundgang mit Beispieldaten an. Die Karte „Erste Schritte“ auf deinem leeren Board hilft beim Rest: Bundesland für die Feiertage, Team, erstes Thema, Smartphone, Sicherungsordner.

**Weitere Geräte:** nur Schritt 3, mit demselben Token und Passwort.

- Rechner (Chrome oder Edge): über das Browsermenü als App installieren.
- iPhone: die Seite in Safari öffnen, „Teilen“ und „Zum Home-Bildschirm“ wählen, dann das Teamboard vom Home-Bildschirm starten und dort verbinden. Die App auf dem Home-Bildschirm hat einen eigenen Speicher, eine Einrichtung in Safari zählt dort nicht.

**Wichtig:** Das Passwort lässt sich nicht zurücksetzen. Wer es verliert, kommt nicht mehr an die Daten. Als Sicherheitsnetz kann das Teamboard auf dem Rechner unter „Mehr“ → „Sicherungsordner wählen“ eine lesbare Kopie und tägliche Sicherungen in einem lokalen Ordner ablegen.

**Token abgelaufen:** Die App meldet „Der Token ist ungültig oder abgelaufen“. Dann unter „Mehr“ abmelden, auf GitHub einen neuen Token erzeugen und neu verbinden. Die Daten bleiben im Repository.

## Wo läuft die App?

Die App wird über GitHub Pages aus diesem Repository ausgeliefert. Du kannst die veröffentlichte Version nutzen oder das Repository forken und unter `https://<dein-name>.github.io/<repo>/` selbst betreiben (Settings → Pages → Deploy from branch, `main`, Ordner `/`).

Wer die Seite ausliefert, bestimmt den Code, der deinen Token und dein Passwort sieht. Wenn du dem Betreiber einer fremden Instanz nicht vertraust, nimm deinen eigenen Fork.

## Wie die Synchronisierung funktioniert

Jede Änderung landet sofort im Speicher des Geräts und wird ein bis zwei Sekunden später als Commit ins Daten-Repository geschrieben, verschlüsselt mit AES-GCM (Schlüssel aus dem Passwort per PBKDF2, 600.000 Runden). Andere Geräte holen Änderungen spätestens nach 30 Sekunden oder wenn die App in den Vordergrund kommt. Ändern zwei Geräte gleichzeitig, führt die App die Stände pro Eintrag zusammen. Offline gehen Änderungen nicht verloren, sie werden nachgereicht. Die Commit-Historie des Daten-Repositorys enthält jeden früheren Stand.

## Entwickeln

Kein Build, keine Abhängigkeiten. Ordner per HTTP ausliefern und im Browser öffnen:

```sh
python -m http.server 8000      # dann http://localhost:8000/?demo=1
```

Test (Python und Playwright):

```sh
pip install playwright && python -m playwright install chromium
python tests/smoke_test.py
```

Einmal pro Klon den Hook aktivieren, der Daten und Tokens aus diesem öffentlichen Repository fernhält:

```sh
git config core.hooksPath .githooks
```

Architektur, Datenmodell und Konventionen stehen in [AGENTS.md](AGENTS.md) (Englisch). Die Oberfläche ist Deutsch.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Die Schrift Nunito Sans steht unter der SIL Open Font License 1.1 ([assets/fonts/OFL.txt](assets/fonts/OFL.txt)).
