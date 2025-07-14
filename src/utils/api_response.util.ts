import { ApiResponse } from "../types/api_response";

export const response = ({
  status,
  title,
  message,
  data,
  meta,
}: {
  status: "success" | "error" | string;
  title: string;
  message: string;
  data?: any;
  meta?: any;
}): ApiResponse => {
  return {
    status,
    title,
    message,
    data,
    meta,
  };
};

export const success = ({
  title,
  message,
  data = null,
  meta,
}: {
  title?: string;
  message?: string;
  data?: any;
  meta?: any;
}): ApiResponse => {
  return response({ status: "success", title, message, data, meta });
};

export const error = ({
  title,
  message,
  data = null,
}: {
  title: string;
  message: string;
  code?: number;
  data?: any;
}): ApiResponse => {
  return response({ status: "error", title, message, data });
};
