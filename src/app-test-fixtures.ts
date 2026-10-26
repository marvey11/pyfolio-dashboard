export const json = (body: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      Array.isArray(body)
        ? {
            items: body,
            pagination: {
              page: 1,
              pageSize: 25,
              totalItems: body.length,
              totalPages: body.length === 0 ? 0 : 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }
        : body,
    ),
    { status, headers: { "Content-Type": "application/json" } },
  );

export const pageJson = (
  items: unknown[],
  page: number,
  pageSize: number,
  totalItems: number,
) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  return json({
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1 && page <= totalPages,
      hasNextPage: page < totalPages,
    },
  });
};

export const country = { code: "DE", name: "Germany" };
export const security = {
  id: 3,
  isin: "US0378331005",
  wkn: "865985",
  name: "Apple",
  instrument_type: "stock",
  country_code: "DE",
};
