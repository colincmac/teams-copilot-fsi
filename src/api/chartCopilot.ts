// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tsyringe requires a reflect polyfill. Please add 'import "reflect-metadata"' to the top of your entry point.
import "reflect-metadata";
import { logging } from "../telemetry/loggerManager";
import { ApiProvider } from "./apiProvider";
import { container, injectable, singleton } from "tsyringe";
import axios, { AxiosError, AxiosResponse, isAxiosError } from "axios";
import { Message } from "@microsoft/teams-ai";
import { Env } from "../env";

const logger = logging.getLogger("bot.apiCopilot");
interface ChartCreationResponse {
  conversation_id: string;
  response: string;
  results: {
    id: string;
    reason: string;
  }[];
}

interface ChartDetailsResponse {
  id: string;
  reason: string;
  preview?: string;
  runner?: {
    chart: {
      id: string;
      active: boolean;
      createdTime: string;
      lastUpdatedTime: string;
      createdById: string;
      lastUpdatedById: string;
      ownerId: string;
      entitlements: {
        view: string[];
        edit: string[];
        admin: string[];
      };
      description: string;
      name: string;
      expressions: {
        hide: boolean;
        color: string;
        label: string;
        axis: string;
      }[];
      ai: string;
      ai_user_prompt: string;
      chartType: string;
      relativeStartDate: string;
      relativeEndDate: string;
      realTime: boolean;
      interval: string;
      version: number;
      descriptionHistory: any[];
    };
    results: {
      type: string;
      values: Record<string, number>;
    }[];
    export: boolean;
    expressions: string[];
    asset_ids: any[];
    entities: any[];
    statistics: {
      low: {
        value: number;
        keys: string[];
      };
      high: {
        value: number;
        keys: string[];
      };
      last: {
        value: number;
        keys: string[];
      };
      median: {
        value: number;
      };
      avg: {
        value: number;
      };
      stdDev: {
        value: number;
      };
      zscore: {
        value: number;
      };
      percentile: {
        value: number;
      };
    }[];
    backtestResults: any[];
    datasets: any[];
    tsdb_symbols: any[];
    requests: {
      responseTime: number;
      domain: string;
      url: string;
      method: string;
      body: any;
      status_code: number;
      action: string;
      request_id: string;
    }[];
    requestId: string;
  };
  render: any;
  source: string;
}

/**
 * This class is a wrapper for the custom Open AI API Endpoint.
 */
@injectable()
@singleton()
export class ChartCopilot extends ApiProvider {
  // constructor
  constructor(baseUrl: string | undefined) {
    // Create an instance of the axios API client.
    super(baseUrl);
  }

  // retrieve authentication headers
  public override async retrieveAuthHeaders(): Promise<
    Record<string, string> | undefined
  > {
    const env = container.resolve(Env);
    const headers: Record<string, string> = {
      "x-marquee-csrf-token": env.data.TOKEN || "",
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Return the authentication headers.
    return headers;
  }

  /**
   * Returns the completion for the specified prompt.
   * @param query The query to search for.
   */
  public completeChat = async (
    prompt: Message
  ): Promise<AxiosResponse<any, any>> => {
    // Construct the URL for the search query
    const generateUrl = "/v1/charts/generate";
    const chartDetailsUrl = (chartId: string) => `/v1/charts/${chartId}`;

    try {
      // Make a GET request to the constructed URL using the Axios instance
      const chartCreationResponse = await this.instance.post(generateUrl, {
        data: { prompt: prompt.content },
      });

      const chartId = chartCreationResponse.data.results[0].id;

      // Polling for the chart to be completed
      let chartDetailsResponse: AxiosResponse<ChartDetailsResponse>;
      let retryCount = 0;
      while (retryCount < 5) {
        chartDetailsResponse = await axios.get<ChartDetailsResponse>(
          chartDetailsUrl(chartId),
        );
  
        // Check if the chart is completed
        if (chartDetailsResponse.data.preview != null) {
          break;
        }
        retryCount++;
        // Wait for a short period before polling again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      return chartCreationResponse;
    } catch (error: Error | AxiosError | any) {
      // If the request fails, log the error and throw an exception
      const defaultMessage = "Failed to get the response from Copilot API";
      if (error?.response?.status || isAxiosError(error)) {
        logger.error(error.response?.data?.message || defaultMessage);
      } else {
        logger.error(defaultMessage, error);
      }
      throw error;
    }
  };



}
