const apiKey = 'be16ae38ed18448fa841abe646187725';
const origin = '21.028231,105.853824';
const dest = '22.487561,103.978611';

async function testGeoapify() {
  const url1 = `https://api.geoapify.com/v1/routing?waypoints=${origin}|${dest}&mode=drive&apiKey=${apiKey}`;
  const r1 = await fetch(url1).then(r => r.json());
  const dist1 = r1.features[0].properties.distance;
  const time1 = r1.features[0].properties.time;
  const coords1 = r1.features[0].geometry.coordinates[0].length;

  const url2 = `https://api.geoapify.com/v1/routing?waypoints=${origin}|${dest}&mode=drive&type=short&apiKey=${apiKey}`;
  const r2 = await fetch(url2).then(r => r.json());
  const dist2 = r2.features[0].properties.distance;
  const time2 = r2.features[0].properties.time;
  const coords2 = r2.features[0].geometry.coordinates[0].length;

  const url3 = `https://api.geoapify.com/v1/routing?waypoints=${origin}|${dest}&mode=drive&avoid=highways&apiKey=${apiKey}`;
  const r3 = await fetch(url3).then(r => r.json());
  const dist3 = r3.features[0].properties.distance;
  const time3 = r3.features[0].properties.time;
  const coords3 = r3.features[0].geometry.coordinates[0].length;

  console.log('Fastest highway:', Math.round(dist1/1000), 'km,', Math.round(time1/60), 'min, coords:', coords1);
  console.log('Shortest:', Math.round(dist2/1000), 'km,', Math.round(time2/60), 'min, coords:', coords2);
  console.log('Avoid highways (National road):', Math.round(dist3/1000), 'km,', Math.round(time3/60), 'min, coords:', coords3);
}

testGeoapify().catch(console.error);
