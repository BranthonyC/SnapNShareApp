import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE = process.env.TABLE_NAME;

export async function getItem(pk, sk) {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: pk, SK: sk },
  }));
  return Item;
}

export async function putItem(item) {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: item,
  }));
}

export async function putItemIfNotExists(item, pkAttr = 'PK') {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: item,
    ConditionExpression: `attribute_not_exists(${pkAttr})`,
  }));
}

export async function updateItem(pk, sk, updateExpr, exprValues, exprNames, conditionExpr) {
  const params = {
    TableName: TABLE,
    Key: { PK: pk, SK: sk },
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: exprValues,
    ReturnValues: 'ALL_NEW',
  };
  if (exprNames) params.ExpressionAttributeNames = exprNames;
  if (conditionExpr) params.ConditionExpression = conditionExpr;
  const { Attributes } = await docClient.send(new UpdateCommand(params));
  return Attributes;
}

export async function deleteItem(pk, sk) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: pk, SK: sk },
  }));
}

export async function queryItems(pk, skPrefix, { limit, cursor, indexName, scanForward = true, filterExpr, exprValues, exprNames } = {}) {
  const params = {
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: { ':pk': pk, ':skPrefix': skPrefix, ...exprValues },
    ScanIndexForward: scanForward,
  };
  if (indexName) {
    params.IndexName = indexName;
    params.KeyConditionExpression = 'GSI1PK = :pk AND begins_with(GSI1SK, :skPrefix)';
    if (indexName === 'GSI2') {
      params.KeyConditionExpression = 'GSI2PK = :pk AND begins_with(GSI2SK, :skPrefix)';
    }
  }
  if (limit) params.Limit = limit;
  if (cursor) params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  if (filterExpr) params.FilterExpression = filterExpr;
  if (exprNames) params.ExpressionAttributeNames = exprNames;

  const { Items, LastEvaluatedKey } = await docClient.send(new QueryCommand(params));
  return {
    items: Items || [],
    nextCursor: LastEvaluatedKey
      ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64url')
      : null,
  };
}

export async function scanItems({ filterExpr, exprValues, exprNames, limit } = {}) {
  const allItems = [];
  let lastKey = undefined;
  do {
    const params = {
      TableName: TABLE,
      ...(filterExpr && { FilterExpression: filterExpr }),
      ...(exprValues && { ExpressionAttributeValues: exprValues }),
      ...(exprNames && { ExpressionAttributeNames: exprNames }),
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    };
    const { Items, LastEvaluatedKey } = await docClient.send(new ScanCommand(params));
    allItems.push(...(Items || []));
    lastKey = LastEvaluatedKey;
    if (limit && allItems.length >= limit) break;
  } while (lastKey);
  return limit ? allItems.slice(0, limit) : allItems;
}

export async function batchDelete(keys) {
  const batches = [];
  for (let i = 0; i < keys.length; i += 25) {
    batches.push(keys.slice(i, i + 25));
  }
  for (const batch of batches) {
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE]: batch.map(key => ({
          DeleteRequest: { Key: key },
        })),
      },
    }));
  }
}
