"use client";

import { useState, useEffect } from "react";
import { orderflowStore } from "./store";
import { Order, UserSession, DashboardMetrics } from "@/types/orderflow";
import { CURRENT_USER } from "./mock-data";

export const INITIAL_METRICS: DashboardMetrics = {
  todayOrders: 0,
  newOrders: 0,
  confirmedOrders: 0,
  packingOrders: 0,
  packedOrders: 0,
  dispatchedOrders: 0,
  smsPending: 0,
  smsFailed: 0,
  stCourierMissingLlr: 0,
  stCourierPendingDelivery: 0,
  actionItems: [],
};

export function useOrderFlow() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<UserSession>(CURRENT_USER);
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [searchQuery, setSearchQueryState] = useState<string>("");
  const [dateFilter, setDateFilterState] = useState<string>("All");
  const [customDate, setCustomDateState] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setOrders([...orderflowStore.getOrders()]);
    setUser({ ...orderflowStore.getCurrentUser() });
    setMetrics({ ...orderflowStore.getMetrics() });
    setSearchQueryState(orderflowStore.getSearchQuery());
    setDateFilterState(orderflowStore.getDateFilter());
    setCustomDateState(orderflowStore.getCustomDate());
    setIsLoaded(true);

    const unsubscribe = orderflowStore.subscribe(() => {
      setOrders([...orderflowStore.getOrders()]);
      setUser({ ...orderflowStore.getCurrentUser() });
      setMetrics({ ...orderflowStore.getMetrics() });
      setSearchQueryState(orderflowStore.getSearchQuery());
      setDateFilterState(orderflowStore.getDateFilter());
      setCustomDateState(orderflowStore.getCustomDate());
    });

    return unsubscribe;
  }, []);

  return {
    orders,
    user,
    isLoaded,
    metrics,
    searchQuery,
    setSearchQuery: (query: string) => orderflowStore.setSearchQuery(query),
    dateFilter,
    setDateFilter: (filter: string) => orderflowStore.setDateFilter(filter),
    customDate,
    setCustomDate: (date: string) => orderflowStore.setCustomDate(date),
    updateOrderStatus: orderflowStore.updateOrderStatus.bind(orderflowStore),
    startPacking: orderflowStore.startPacking.bind(orderflowStore),
    markAsPacked: orderflowStore.markAsPacked.bind(orderflowStore),
    markAsDispatched: orderflowStore.markAsDispatched.bind(orderflowStore),
    updateCourierDetails: orderflowStore.updateCourierDetails.bind(orderflowStore),
    syncPing4SmsStatus: orderflowStore.syncPing4SmsStatus.bind(orderflowStore),
    switchRole: orderflowStore.switchRole.bind(orderflowStore),
    resetData: orderflowStore.resetData.bind(orderflowStore),
  };
}
