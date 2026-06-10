import { seedGatewayConfigs } from './001-gateway-config';

async function runSeeds() {
  console.log('Running database seeds...');
  await seedGatewayConfigs();
  console.log('All seeds completed successfully.');
}

runSeeds().then(() => process.exit(0));
