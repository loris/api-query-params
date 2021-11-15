declare module 'api-query-params' {
  type PopulateOptions = {
    path: string;
    select?: any;
  }

  type Query = {
    [key: string]: undefined | string | string[] | Query | Query[]
  }

  export type AqpQuery = {
    filter: Record<string, any>;
    skip: number;
    limit: number;
    sort: Record<string, number>;
    projection: Record<string, number>;
    population: PopulateOptions[];
  };

  function aqp(
    query: string | Query,
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