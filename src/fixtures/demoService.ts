import type { ServiceRecord } from '../domain/service/service'
import { parseSongNotation } from '../domain/service/songNotation'

export const demoService: ServiceRecord = {
  id: 'platform-demo-2026-10-04',
  venue: 'Sede Central',
  service: {
    schemaVersion: '0.1',
    id: 'platform-demo-2026-10-04',
    title: 'Culto General',
    startsAt: '2026-10-04T19:00:00-03:00',
    setlist: { id: 'platform-demo-setlist', name: 'Culto General' },
    items: [
      {
        id: 'welcome',
        kind: 'ANNOUNCEMENT',
        announcement: {
          title: 'Bienvenida',
          body: 'Bienvenidos al culto de La Voz Misionera.',
        },
      },
      {
        id: 'song-opening',
        kind: 'SONG',
        song: {
          id: 'opening',
          title: 'Canto de apertura',
          key: 'A',
          sections: parseSongNotation(
            '# Verso 1\n[A]Alzamos hoy la voz\n[E]Con gratitud y fe\n\n# Coro\n[D]Cantamos juntos aquí\n[A]Tu luz nos guiará',
          ),
        },
      },
      {
        id: 'song-thanks',
        kind: 'SONG',
        song: {
          id: 'thanks',
          title: 'Canto de gratitud',
          key: 'G',
          sections: parseSongNotation(
            '# Verso 1\n[G]Gracias por este día\n[D]Y por tu amor\n\n# Coro\n[C]Seguimos con esperanza',
          ),
        },
      },
      {
        id: 'scripture',
        kind: 'SCRIPTURE',
        scripture: {
          reference: 'Juan 3:16',
          version: 'RV1909',
          text: 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito...',
          source: 'https://ebible.org/spaRV1909/JHN03.htm',
        },
      },
      {
        id: 'announcement',
        kind: 'ANNOUNCEMENT',
        announcement: {
          title: 'Encuentro de jóvenes',
          body: 'Sábado a las 18:00 en Sede Central.',
        },
      },
      {
        id: 'sermon',
        kind: 'SERMON',
        sermon: {
          title: 'El buen pastor',
          body: 'Lectura y reflexión del día.',
        },
      },
    ],
  },
}
