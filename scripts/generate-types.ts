import { database } from '../tests/database';
import { writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
async function main() {
  const db = await database(false);
  try {
    const rows = await db.query<{ name: string; args: string; result: string }>(
      `select p.proname name, pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('portal','enquire','content_public','schema_version') order by p.proname`,
    );
    const funcs = rows.rows
      .map((r) => {
        const args = r.args
          .split(',')
          .filter((a) => a.trim())
          .map((a) => {
            const [name, type] = a.trim().split(' ');
            return `${name}${a.includes('DEFAULT') ? '?' : ''}: ${type === 'uuid' ? 'string | null' : type === 'jsonb' ? 'Json' : 'string'}`;
          })
          .join('; ');
        return `${r.name}: { Args: {${args}}; Returns: ${r.result === 'integer' ? 'number' : 'Json'} };`;
      })
      .join('\n');
    await writeFile(
      'src/shared/database.types.ts',
      await format(
        `// Generated from migration SQL PostgreSQL catalog. Regenerate: npm run db:types\nexport type Json = string | number | boolean | null | {[key:string]:Json|undefined} | Json[];\nexport type Database = {public:{Tables:Record<string,never>;Views:Record<string,never>;Enums:Record<string,never>;CompositeTypes:Record<string,never>;Functions:{\n${funcs}\n}}};\n`,
        { ...(await resolveConfig('.prettierrc.json')), parser: 'typescript' },
      ),
    );
    console.log(
      'Generated public RPC database types. Private tables are intentionally outside the API schema.',
    );
  } finally {
    await db.close();
  }
}
main().catch(() => {
  console.error('Type generation failed');
  process.exitCode = 1;
});
