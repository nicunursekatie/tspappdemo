#!/usr/bin/env python3
"""
Import Scott's authoritative weekly collection data from Excel into the database.

This script reads the 'InputData' sheet from Scott's Excel file and imports
the verified weekly sandwich totals into the authoritative_weekly_collections table.

Usage:
    python3 server/scripts/import-scott-data-python.py

Requirements:
    - openpyxl: pip install openpyxl
    - psycopg2: pip install psycopg2-binary
"""

import os
import sys
from datetime import datetime
from collections import defaultdict

try:
    import openpyxl
except ImportError:
    print("Error: openpyxl not installed. Run: pip install openpyxl")
    sys.exit(1)

try:
    import psycopg2
except ImportError:
    print("Error: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


def get_database_url():
    """Get database URL from environment variable."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("Error: DATABASE_URL environment variable not set")
        sys.exit(1)
    return db_url


def import_scott_data():
    """Import Scott's authoritative data from Excel."""

    # Path to Excel file
    excel_path = 'attached_assets/New Sandwich Totals Scott (5)_1761847323011.xlsx'

    if not os.path.exists(excel_path):
        print(f"Error: Excel file not found at {excel_path}")
        sys.exit(1)

    print("📊 Reading Scott's authoritative Excel file...")
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    sheet = wb['InputData']

    # Read all rows
    rows = list(sheet.iter_rows(values_only=True))
    print(f"Found {len(rows) - 1} total data rows")

    # Process records
    records = []
    skipped = 0

    for row in rows[1:]:  # Skip header
        date_val, location, sandwiches, week_of_year, week_of_program, year, _ = row[:7] + (None,) * (7 - len(row[:7]))

        # Validate year
        if not year or not isinstance(year, (int, float)) or year < 2020 or year > 2025:
            skipped += 1
            continue

        year = int(year)

        # Validate sandwiches
        if not isinstance(sandwiches, (int, float)) or sandwiches < 0 or sandwiches > 100000:
            skipped += 1
            continue

        sandwiches = int(sandwiches)

        # Parse date
        if isinstance(date_val, datetime):
            week_date = date_val.strftime('%Y-%m-%d')
        else:
            skipped += 1
            continue

        # Get location
        location = str(location) if location else 'Unknown'

        # Get week numbers
        week_of_year = int(week_of_year) if isinstance(week_of_year, (int, float)) else 0
        week_of_program = int(week_of_program) if isinstance(week_of_program, (int, float)) else 0

        records.append({
            'week_date': week_date,
            'location': location,
            'sandwiches': sandwiches,
            'week_of_year': week_of_year,
            'week_of_program': week_of_program,
            'year': year
        })

    print(f"Prepared {len(records)} valid records (skipped {skipped} invalid)")

    # Preview by year
    year_totals = defaultdict(lambda: {'count': 0, 'sandwiches': 0})
    for r in records:
        year_totals[r['year']]['count'] += 1
        year_totals[r['year']]['sandwiches'] += r['sandwiches']

    print("\nData by year:")
    for year in sorted(year_totals.keys()):
        data = year_totals[year]
        print(f"  {year}: {data['count']:,} records, {data['sandwiches']:,} sandwiches")

    # Connect to database
    print("\n🔌 Connecting to database...")
    db_url = get_database_url()
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    try:
        # Clear existing data
        print("🗑️  Clearing existing authoritative data...")
        cursor.execute("TRUNCATE TABLE authoritative_weekly_collections RESTART IDENTITY")

        # Import records in batches
        print(f"\n📥 Importing {len(records)} records...")
        batch_size = 100
        imported = 0

        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]

            # Build INSERT statement
            values = []
            for r in batch:
                # Escape single quotes in location
                location = r['location'].replace("'", "''")
                values.append(f"('{r['week_date']}', '{location}', {r['sandwiches']}, {r['week_of_year']}, {r['week_of_program']}, {r['year']})")

            sql = f"""
                INSERT INTO authoritative_weekly_collections
                    (week_date, location, sandwiches, week_of_year, week_of_program, year)
                VALUES {', '.join(values)}
            """
            cursor.execute(sql)

            imported += len(batch)
            print(f"  Imported {imported}/{len(records)} records...")

        # Commit transaction
        conn.commit()
        print("\n✅ Import committed successfully!")

        # Verify
        print("\n🔍 Verifying import...")
        cursor.execute("""
            SELECT
                year,
                COUNT(*) as record_count,
                SUM(sandwiches) as total_sandwiches
            FROM authoritative_weekly_collections
            GROUP BY year
            ORDER BY year
        """)

        print("\nDatabase totals by year:")
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]:,} records, {row[2]:,} sandwiches")

        # Get grand total
        cursor.execute("SELECT COUNT(*), SUM(sandwiches) FROM authoritative_weekly_collections")
        total = cursor.fetchone()
        print(f"\n🎉 Total: {total[0]:,} records, {total[1]:,} sandwiches")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    import_scott_data()
