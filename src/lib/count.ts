// Counted phrases carry their own verb agreement, which a naive pluralizer cannot infer ("1 claim needs", "2 claims need").
export const countLabel = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
