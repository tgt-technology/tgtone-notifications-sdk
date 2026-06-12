# Arquitectura — Sistema de Notificaciones

## Modelo de datos

### 1 notificación = 1 registro en BD

El sistema es **1:N puro**. Una acción genera 1 registro en la tabla `notifications`.
No se duplica por destinatario. El filtro se aplica en **lectura**, no en creación.

```
Tabla: notifications
┌──────────────────────────────────────────────────────┐
│ id        │ UUID (PK)                                │
│ tenant_id │ FK → tenants                             │
│ app_id    │ "baco", "nexo", "crm", etc.              │
│ title     │ "Ticket SUP-001 asignado"                │
│ message   │ "El ticket fue asignado al equipo Soporte"│
│ type      │ info | success | warning | error          │
│ priority  │ low | normal | high | urgent              │
│ target_user_id │ null = broadcast / string = personal │
│ metadata  │ JSONB (GIN index) — app-specific          │
│           │ ej: { "teamId": "soporte" }               │
│ action_url  │ "/tickets/SUP-001"                      │
│ expires_at  │ created_at + 7 días                     │
│ deleted_at  │ soft delete (null = activa)             │
│ created_by  │ userId o null (sistema)                 │
│ created_at  │ now()                                   │
└──────────────────────────────────────────────────────┘

Tabla: notification_reads
┌──────────────────────────────────────┐
│ notification_id │ FK → notifications │
│ user_id         │ UUID               │
│ read_at         │ now()              │
│ UNIQUE(notification_id, user_id)     │
└──────────────────────────────────────┘
```

### Cómo se lee

```sql
SELECT n.*, nr.read_at
FROM notifications n
LEFT JOIN notification_reads nr
  ON nr.notification_id = n.id
  AND nr.user_id = 'pedro-uuid'
WHERE n.tenant_id = 'tenant-1'
  AND (n.expires_at IS NULL OR n.expires_at > NOW())
  AND n.deleted_at IS NULL
  AND (
    n.target_user_id = 'pedro-uuid'              ← personales
    OR (
      n.target_user_id IS NULL                   ← broadcasts
      AND (
        n.metadata IS NULL                       ← sin metadata = todos ven
        OR n.metadata->>'teamId' = 'soporte'     ← coincide con filtro
        OR n.metadata->>'teamId' = 'ti'
      )
    )
  )
ORDER BY n.priority DESC, n.created_at DESC
LIMIT 5
```

---

## Separación de concerns

```
Core Backend (notifications)          App (Nexo, Baco, CRM...)
──────────────────────────────        ──────────────────────────
CREATE: guarda 1 registro             API: create({ appId, metadata })
        metadata es JSON opaco              metadata: { teamId }
        No sabe qué significa         metadata: { projectId }
        Solo tiene índice GIN         metadata: cualquier estructura

READ: WHERE filtro combinado          Hook: useNotifications({
        targetUserId = userId                filter: { metadata: { teamId } }
        OR broadcasts sin metadata            limit: 5
        OR broadcasts con metadata          })
        que coincida con filtro

MARK AS READ: upsert en             UI: markAsRead(id) / markAllAsRead()
  notification_reads

CLEANUP: borra expiradas             Cron: endpoint /cleanup
  (targeted leídas +7d               (solo autenticado)
   broadcast expiradas +7d)
```

---

## Flujo end-to-end

```
1. Pedro (equipo soporte) cierra ticket SUP-001

   Nexo Backend:
     api.create({
       appId: 'nexo',
       title: 'Ticket SUP-001 cerrado',
       message: 'Pedro cerró el ticket SUP-001',
       metadata: { teamId: 'soporte' },
     })
     → 1 registro en BD

2. María (equipo soporte) abre Nexo 5 seg después

   Nexo Frontend:
     useNotifications({
       appId: 'nexo',
       filter: { metadata: { teamId: ['soporte'] } },
       limit: 5,
     })
     → GET /api/v1/notifications?appId=nexo&metadata.teamId=soporte&take=10
     → Backend devuelve 1 notif (la de Pedro)
     → María la ve en la campana

3. Juan (equipo TI) abre Nexo

   useNotifications({
     filter: { metadata: { teamId: ['ti'] } },
   })
   → Backend filtra por teamId=ti
   → Juan NO ve la notif de Pedro (es de soporte, no ti)
   → Pero ve broadcasts sin metadata (todos las ven)
```

---

## Índices

```prisma
@@index([tenantId, appId, createdAt(sort: Desc)])  // Consultas por app
@@index([tenantId, appId, targetUserId])             // Filtro personales
@@index([expiresAt])                                  // Cleanup
@@index([metadata], type: Gin)                       // Filtro metadata JSONB
```

El índice GIN en la columna JSONB permite hacer consultas eficientes como:
```sql
WHERE metadata @> '{"teamId": "soporte"}'::jsonb
```

Sin el índice GIN, cada consulta haría un full scan de la tabla.
