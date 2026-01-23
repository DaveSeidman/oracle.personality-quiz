export const modeRandomTie = (arr) => {
  console.log('finding the mode in', arr)
  if (!Array.isArray(arr) || arr.length === 0) return undefined;

  const counts = new Map();
  let max = 0;

  for (const v of arr) {
    const n = (counts.get(v.id) || 0) + 1;
    counts.set(v.id, n);
    if (n > max) max = n;
  }

  const top = [];
  for (const [v, n] of counts) {
    if (n === max) top.push(v);
  }

  return top[Math.floor(Math.random() * top.length)];
}

export const shuffle = (array) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const getBestOption = (array) => {
  const choices = {};

  array.forEach(response => {
    if (!choices[response.id]) {
      choices[response.id] = {
        id: response.id,
        count: 1,
        delay: response.delay,
        orders: [response.order]
      };
    } else {
      choices[response.id] = {
        ...choices[response.id],
        count: choices[response.id].count + 1,
        delay: choices[response.id].delay + response.delay,
        orders: [...choices[response.id].orders, response.order]
      };
    }
  });

  // turn into array
  const results = Object.values(choices);

  // sort by count desc, then delay asc
  results.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.delay - b.delay;
  });

  // return the best one
  return results[0] || null;
}