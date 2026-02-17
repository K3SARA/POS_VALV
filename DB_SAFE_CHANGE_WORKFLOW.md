# DB-Safe Change Workflow

Use this workflow when you want frontend/backend changes without risking existing production data.

## 1) Frontend-only changes (safe for DB)

- Edit only `frontend/` files.
- Deploy frontend service.
- No DB schema/data changes happen.

## 2) Backend code changes without schema changes

- Edit backend route/business logic files only (for example `backend/src/*`).
- Do not edit `backend/prisma/schema.prisma`.
- Deploy backend normally.

## 3) Backend schema changes (safe path)

1. Create migration locally:

```powershell
cd d:\\POS_NEW\\backend
npx prisma migrate dev --name <describe_change>
```

2. Commit:
- `backend/prisma/migrations/*`
- `backend/prisma/schema.prisma`

3. Deploy backend with migration apply:
- Railway uses `npm run start:railway`
- `start:railway` now runs `prisma migrate deploy && node dist/index.js`

## 4) Backup recommendation

Before production schema deploy:
- Take a Railway DB backup/snapshot/export.

## 5) Avoid on production DB

- Avoid `prisma migrate reset`
- Avoid `prisma db push` (unless intentionally doing unsafe sync)

If absolutely needed, `start:railway:unsafe` is available, but do not use it on production without backup.

