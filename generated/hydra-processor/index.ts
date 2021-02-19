#!/usr/bin/env node

import dotenv from "dotenv";
import chalk from "chalk";
import figlet from "figlet";
import commander from "commander";
import path from "path";
import { configure, getLogger } from "log4js";

import { ProcessorRunner } from "@dzlzv/hydra-processor";
import { DatabaseManager } from "@dzlzv/hydra-db-utils";
import { SubstrateEvent } from "@dzlzv/hydra-common";

// Mappings use!
export { DatabaseManager as DB, getLogger, SubstrateEvent };

const logger = getLogger();

const withErrors = (command: (...args: any[]) => Promise<void>) => {
  return async (...args: any[]) => {
    try {
      await command(...args);
    } catch (e) {
      console.log(chalk.red(e.stack));
      process.exit(1);
    }
  };
};

const withEnvs = (command: (...args: any[]) => Promise<void>) => {
  return async (opts: any) => {
    setUp(opts);
    await command(opts);
  };
};

function main(): commander.Command {
  console.log(chalk.green(figlet.textSync("Hydra-Processor")));
  const program = new commander.Command();
  //const version = require('package.json').version

  //program.version(version).description('Hydra Processor')

  program
    .command("run")
    .option("-h, --height", "starting block height")
    .option("-e, --env <file>", ".env file location", "../../.env")
    .option("-m, --mappings <file>", "package with mappings", "../../mappings")
    .option(
      "--entities <path>",
      "typeorm entities glob",
      "../graphql-server/src/modules/**/*.model.ts"
    )
    .description("Process the event and extrinsic mappings using the index")
    .action(withErrors(withEnvs(runProcessor)));

  program
    .command("migrate")
    .description("Create the indexer schema")
    .option("-e, --env <file>", ".env file location", ".env")
    .action(withErrors(withEnvs(runMigrations)));

  program.parse(process.argv);

  return program;
}

function setUp(opts: any) {
  // dotenv config
  dotenv.config();
  dotenv.config({ path: opts.env });

  if (opts.height) {
    process.env.BLOCK_HEIGHT = opts.height;
  } else if (!process.env.BLOCK_HEIGHT) {
    process.env.BLOCK_HEIGHT = "0";
  }

  //log4js config
  if (opts.logging) {
    configure(opts.logging);
  } else {
    // log4js default: DEBUG to console output;
    getLogger().level = "debug";
  }
}

async function runProcessor(opts: any) {
  const node = new ProcessorRunner();
  const atBlock = process.env.BLOCK_HEIGHT;
  await node.process({
    atBlock: atBlock && atBlock !== "0" ? Number.parseInt(atBlock) : undefined,
    processingPack: require(opts.mappings),
    entities: [path.join(__dirname, opts.entities)],
    indexerEndpointURL: process.env.INDEXER_ENDPOINT_URL
  });
}

async function runMigrations() {
  logger.info(`Running migrations`);
  await ProcessorRunner.migrate();
}

main();
