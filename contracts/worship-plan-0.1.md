# Worship handoff 0.1

Platform owns the service and sends Worship a small JSON context file. Worship returns a `WorshipPlan 0.1` file containing only music. Platform inserts it after the selected service item and exports the unchanged `Service 0.1` format to Presenter.

## Context: Platform → Worship

```json
{
  "schemaVersion": "0.1",
  "serviceId": "culto-2026-10-04",
  "title": "Culto General",
  "startsAt": "2026-10-04T22:00:00.000Z",
  "setlistId": "setlist-culto-2026-10-04",
  "name": "Adoración"
}
```

The context carries no service items, people, permissions, or Presenter settings. Worship stores the imported context and its editable draft in the same browser profile so it can be reopened without a network connection.

## Plan: Worship → Platform

```json
{
  "schemaVersion": "0.1",
  "serviceId": "culto-2026-10-04",
  "setlistId": "setlist-culto-2026-10-04",
  "name": "Adoración",
  "songs": [
    {
      "songId": "senor-fiel",
      "title": "Señor fiel",
      "key": "G",
      "arrangement": [1, 2, 1, 2],
      "sections": [
        {
          "kind": "verse",
          "label": "Verso",
          "lines": [
            {
              "text": "Señor, eres fiel",
              "chords": [{ "symbol": "G", "index": 0 }]
            }
          ]
        },
        {
          "kind": "chorus",
          "label": "Coro",
          "lines": [{ "text": "Cantaré", "chords": [] }]
        },
        {
          "kind": "verse",
          "label": "Verso",
          "lines": [
            {
              "text": "Señor, eres fiel",
              "chords": [{ "symbol": "G", "index": 0 }]
            }
          ]
        },
        {
          "kind": "chorus",
          "label": "Coro",
          "lines": [{ "text": "Cantaré", "chords": [] }]
        }
      ]
    }
  ]
}
```

`songs` preserves setlist order and may repeat `songId`. Each number in `arrangement` is a one-based index into the source song's lyric sections; `sections` contains the expanded occurrences in exactly that order. Its length must equal `arrangement.length`. Chord `index` is a UTF-16 code unit offset in `text`, including the end position. An offset cannot split a surrogate pair.

Platform validates every field and checks `service.id === plan.serviceId` before changing the saved service. It creates a distinct Service item ID for each song occurrence, even when `songId` repeats. The selected point means “insert the Worship repertoire after this item.” Applying another plan removes only items previously created by Worship for this service (`lvm-worship:<serviceId>:`) and inserts the new repertoire at that point. Every manually created service item remains in place, including songs immediately after the selected point. Presenter consumes only the resulting Service 0.1 file.

## Local workflow

1. In Platform, create the service and its nonmusical items. Under **Orden**, choose where the musical block goes and export **contexto para Worship**.
2. In Worship's local `/setlist` draft, open that context. Add songs from the library when available, or import local ChordPro files when offline. Set keys, arrangement, order, and repeats. Export **Guardar para Platform**.
3. In Platform, import the WorshipPlan file. Review the full order, then export **Service 0.1** under **Presentación**.
4. In Presenter, convert the Service JSON to `.project`, import it, and save the project before closing. Keep the JSON, WorshipPlan, and `.project` files as portable backups of the local state.
