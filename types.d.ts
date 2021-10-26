declare module 'api-query-params' {
  export type AqpQuery = {
    filter: Record<string, any>;
    skip: number;
    limit: number;
    sort: Record<string, number>;
    projection: Record<string, number>;
  };

  function aqp(
    query: string | Record<string, string>,
    opt?: {
      skipKey?: string;
      limitKey?: string;
      projectionKey?: string;
      sortKey?: string;
      filterKey?: string;
      populationKey?: string;

      blacklist?: string[];
      whitelist?: string[];

      castParams?: unknown;
      casters?: unknown;
    }
  ): AqpQuery;

  export default aqp;
}
