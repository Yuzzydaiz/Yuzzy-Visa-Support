/* eslint-disable */
import type { GenericId } from "convex/values";
import type { GenericDataModel } from "convex/server";

export type TableNames = "contactMessages" | "subscribers";
export type Doc<TableName extends TableNames> = any;
export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;
export type SystemTableNames = "_storage" | "_scheduled_functions";
export type DataModel = GenericDataModel;
