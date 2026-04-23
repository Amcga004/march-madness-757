export function getLogicalGameDate(): string {
  // Returns the logical game date in ET
  // A new day starts at 6am ET, not midnight UTC
  // So 3am ET on April 23 = logical date April 22
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(
    jan.getTimezoneOffset(),
    jul.getTimezoneOffset()
  );
  const isDST = now.getTimezoneOffset() < stdOffset;
  const offsetHours = isDST ? -4 : -5; // EDT or EST

  const etDate = new Date(
    now.getTime() + offsetHours * 60 * 60 * 1000
  );

  // If before 6am ET, roll back to previous day
  if (etDate.getUTCHours() < 6) {
    etDate.setUTCDate(etDate.getUTCDate() - 1);
  }

  return etDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function getLogicalDateWindow(date: string): {
  start: string;
  end: string;
} {
  // Returns UTC start/end for a logical game date
  // Logical day starts at 6am ET = 10am UTC (EDT) or 11am UTC (EST)
  // Logical day ends at 6am ET next day = 10am UTC next day
  //
  // For simplicity use 10am UTC as boundary (covers EDT)
  // This means: April 23 logical day = April 23 10:00 UTC to April 24 10:00 UTC
  return {
    start: `${date}T10:00:00Z`,
    end: `${new Date(new Date(date + 'T10:00:00Z').getTime() + 86400000).toISOString().split('.')[0]}Z`,
  };
}
