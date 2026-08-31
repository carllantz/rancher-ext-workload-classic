import { filterTopLevelRows, allowedWorkloadTypes } from '../rows';

describe('filterTopLevelRows', () => {
  it('keeps rows that are not owned by a workload', () => {
    const rows = [[{ id: 'a', ownedByWorkload: false }, { id: 'b' }]];

    expect(filterTopLevelRows(rows)).toStrictEqual([
      { id: 'a', ownedByWorkload: false },
      { id: 'b' },
    ]);
  });

  it('drops rows owned by a workload', () => {
    const rows = [[{ id: 'rs', ownedByWorkload: true }, { id: 'deploy' }]];

    expect(filterTopLevelRows(rows)).toStrictEqual([{ id: 'deploy' }]);
  });

  it('flattens across type buckets', () => {
    const rows = [[{ id: 'a' }], [{ id: 'b' }]];

    expect(filterTopLevelRows(rows)).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('skips buckets that failed to load', () => {
    const rows = [null, [{ id: 'a' }], undefined];

    expect(filterTopLevelRows(rows)).toStrictEqual([{ id: 'a' }]);
  });

  it('returns an empty array when nothing loaded', () => {
    expect(filterTopLevelRows([])).toStrictEqual([]);
  });
});

describe('allowedWorkloadTypes', () => {
  it('keeps only types the user has a schema for', () => {
    const hasSchema = (type: string) => type !== 'batch.job';

    expect(allowedWorkloadTypes(['apps.deployment', 'batch.job'], hasSchema))
      .toStrictEqual(['apps.deployment']);
  });

  it('returns an empty array when the user can see nothing', () => {
    expect(allowedWorkloadTypes(['apps.deployment'], () => false)).toStrictEqual([]);
  });

  it('returns an empty array for no input types', () => {
    expect(allowedWorkloadTypes([], () => true)).toStrictEqual([]);
  });
});
