# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# H10: Admin-Feedback-Page Embed-Fix + Auto-Refresh-Stop bei Error

> Cowork-QA, 19:10. 2 kleine Aenderungen, beide in 1 Datei.

## Kontext

`/dashboard-admin/feedback` crasht mit `Could not find a relationship between 'feedback' and 'profiles' in the schema cache`. Plus: Auto-Refresh feuert alle 60s einen weiteren Error-Toast → Toast-Spam-Mauer (Screenshot in Cowork-QA-Iteration 8).

Cowork hat schon einen neuen FK angelegt:
```
ALTER TABLE feedback ADD CONSTRAINT feedback_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
```

→ DB-Seite ist bereit. Code muss nur den FK-Namen-Hint nachziehen.

## Fix

Datei: `app/dashboard-admin/feedback/page.tsx`

### 1. Embed-Hint umbenennen (Zeile 60)

**Vorher:**
```tsx
user:profiles!feedback_user_id_fkey ( name, email )
```

**Nachher:**
```tsx
user:profiles!feedback_user_id_profiles_fkey ( name, email )
```

(Der alte FK `feedback_user_id_fkey` zeigt auf `auth.users`, kann nicht zum profiles-Join genutzt werden. Der neue heisst `feedback_user_id_profiles_fkey`.)

### 2. Auto-Refresh bei Error stoppen + Toast deduplizieren

Aktueller `useEffect` (Zeile ~91):
```tsx
useEffect(() => {
  if (!autoRefresh) return
  const id = setInterval(() => { void load() }, 60_000)
  return () => clearInterval(id)
}, [autoRefresh, load])
```

In der `load`-Funktion (Zeile ~53):
- Setze einen `errorCount`-State (useState).
- Bei Error: `errorCount + 1`. Wenn `errorCount >= 1` → `setAutoRefresh(false)` und Toast nur einmal zeigen.
- Bei Success: `setErrorCount(0)`.

Alternative simpler: ein `useRef<string|null>(null)` fuer `lastErrorMessage`. Wenn `error.message === lastErrorMessage.current` → kein neuer Toast. Bei jedem Success: ref auf null setzen.

Sinnvoll wenn moeglich: User-feedback „Auto-Refresh wegen Fehler pausiert — pruefe Verbindung und manuell aktualisieren."

### 3. Commit

`fix(admin-feedback): profile-embed FK-name + auto-refresh stop on error (H10)`

## Constraints

- Nur diese 1 Datei aendern
- Keine neuen Dependencies
- Pro Phase max. 1 Klaerungsfrage

## Erster Schritt

Diff zeigen wenn du was Komisches im File siehst — sonst direkt impl. + commit + push. Cowork (im anderen Chat) testet sofort nach Deploy.
