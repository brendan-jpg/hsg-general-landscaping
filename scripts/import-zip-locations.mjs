#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_CSV_PATH = path.resolve(process.cwd(), 'imports/simplemaps_uszips_basicv1.94/uszips.csv');
const BATCH_SIZE = 1000;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function parseCsvLine(line) {
  const output = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      output.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  output.push(current);
  return output;
}

function toNullableInteger(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRequiredFloat(value, fieldName) {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName} value "${String(value ?? '')}"`);
  }
  return parsed;
}

function toBoolean(value) {
  return String(value ?? '').trim().toUpperCase() === 'TRUE';
}

function buildRow(columns, values) {
  const record = Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
  const zip = String(record.zip ?? '').trim();
  const city = String(record.city ?? '').trim();
  const stateId = String(record.state_id ?? '').trim().toUpperCase();
  const stateName = String(record.state_name ?? '').trim();

  if (!/^\d{5}$/.test(zip)) return null;
  if (!city || !stateId || !stateName) return null;

  return {
    zip,
    city,
    state_id: stateId,
    state_name: stateName,
    lat: toRequiredFloat(record.lat, 'lat'),
    lng: toRequiredFloat(record.lng, 'lng'),
    population: toNullableInteger(record.population),
    county_name: String(record.county_name ?? '').trim() || null,
    timezone: String(record.timezone ?? '').trim() || null,
    imprecise: toBoolean(record.imprecise),
    military: toBoolean(record.military),
  };
}

async function flushBatch(supabase, batch, count) {
  if (batch.length === 0) return count;
  const { error } = await supabase.from('zip_locations').upsert(batch, { onConflict: 'zip' });
  if (error) {
    throw new Error(`Failed importing batch ending at row ${count}: ${error.message}`);
  }
  return count;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(process.cwd(), String(args.file || DEFAULT_CSV_PATH));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  if (!key) fail('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is not configured.');
  if (!fs.existsSync(csvPath)) fail(`CSV file not found: ${csvPath}`);

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const lineReader = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let columns = null;
  let count = 0;
  let batch = [];

  for await (const line of lineReader) {
    if (!columns) {
      columns = parseCsvLine(line);
      continue;
    }

    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row = buildRow(columns, values);
    if (!row) continue;

    batch.push(row);
    count += 1;

    if (batch.length >= BATCH_SIZE) {
      await flushBatch(supabase, batch, count);
      console.log(`Imported ${count} ZIP rows...`);
      batch = [];
    }
  }

  await flushBatch(supabase, batch, count);
  console.log(`Imported ${count} ZIP rows from ${csvPath}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
