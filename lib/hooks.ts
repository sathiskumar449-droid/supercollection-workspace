"use client";

import { useState, useEffect } from "react";
import { orderflowStore } from "./store";
import { Order, UserSession, DashboardMetrics, ReturnCase, ReturnMetrics } from "@/types/orderflow";
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
  const [returns, setReturns] = useState<ReturnCase[]>([]);
  const [user, setUser] = useState<UserSession>(CURRENT_USER);
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [searchQuery, setSearchQueryState] = useState<string>("");
  const [dateFilter, setDateFilterState] = useState<string>("All");
  const [customDate, setCustomDateState] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setOrders([...orderflowStore.getOrders()]);
    setReturns([...orderflowStore.getReturns()]);
    setUser({ ...orderflowStore.getCurrentUser() });
    setMetrics({ ...orderflowStore.getMetrics() });
    setSearchQueryState(orderflowStore.getSearchQuery());
    setDateFilterState(orderflowStore.getDateFilter());
    setCustomDateState(orderflowStore.getCustomDate());
    setIsLoaded(true);

    const unsubscribe = orderflowStore.subscribe(() => {
      setOrders([...orderflowStore.getOrders()]);
      setReturns([...orderflowStore.getReturns()]);
      setUser({ ...orderflowStore.getCurrentUser() });
      setMetrics({ ...orderflowStore.getMetrics() });
      setSearchQueryState(orderflowStore.getSearchQuery());
      setDateFilterState(orderflowStore.getDateFilter());
      setCustomDateState(orderflowStore.getCustomDate());
    });

    return unsubscribe;
  }, []);

  const activeReturnsCount = orderflowStore.getActiveReturnsCount();

  return {
    orders,
    returns,
    activeReturnsCount,
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
    setOrderPending: orderflowStore.setOrderPending.bind(orderflowStore),
    resolveOrderPending: orderflowStore.resolveOrderPending.bind(orderflowStore),
    bulkUpdateOrderStatus: orderflowStore.bulkUpdateOrderStatus.bind(orderflowStore),
    startPacking: orderflowStore.startPacking.bind(orderflowStore),
    markAsPacked: orderflowStore.markAsPacked.bind(orderflowStore),
    markAsDispatched: orderflowStore.markAsDispatched.bind(orderflowStore),
    updateCourierDetails: orderflowStore.updateCourierDetails.bind(orderflowStore),
    verifyCourierPickupByCustomerMobile: orderflowStore.verifyCourierPickupByCustomerMobile.bind(orderflowStore),
    bulkUpdateCourierStatus: orderflowStore.bulkUpdateCourierStatus.bind(orderflowStore),
    syncPing4SmsStatus: orderflowStore.syncPing4SmsStatus.bind(orderflowStore),
    bulkSyncPing4SmsStatus: orderflowStore.syncPing4SmsStatus.bind(orderflowStore),
    updateSmsStatus: orderflowStore.updateSmsStatus.bind(orderflowStore),
    bulkUpdateSmsStatus: orderflowStore.bulkUpdateSmsStatus.bind(orderflowStore),
    courierPartners: orderflowStore.getCourierPartners(),
    addCourierPartner: orderflowStore.addCourierPartner.bind(orderflowStore),
    updateCourierPartner: orderflowStore.updateCourierPartner.bind(orderflowStore),
    toggleCourierPartner: orderflowStore.toggleCourierPartner.bind(orderflowStore),
    userOrders: orderflowStore.getOrdersForUser(user),
    switchRole: orderflowStore.switchRole.bind(orderflowStore),
    resetData: orderflowStore.resetData.bind(orderflowStore),
    // Returns API
    getReturns: orderflowStore.getReturns.bind(orderflowStore),
    getReturnById: orderflowStore.getReturnById.bind(orderflowStore),
    getReturnsByOrderId: orderflowStore.getReturnsByOrderId.bind(orderflowStore),
    getReturnMetrics: orderflowStore.getReturnMetrics.bind(orderflowStore),
    createReturnCase: orderflowStore.createReturnCase.bind(orderflowStore),
    updateReturnStatus: orderflowStore.updateReturnStatus.bind(orderflowStore),
    recordReturnReceived: orderflowStore.recordReturnReceived.bind(orderflowStore),
    performQcCheck: orderflowStore.performQcCheck.bind(orderflowStore),
    processRefund: orderflowStore.processRefund.bind(orderflowStore),
    createReplacementTask: orderflowStore.createReplacementTask.bind(orderflowStore),
    updateReplacementDispatch: orderflowStore.updateReplacementDispatch.bind(orderflowStore),
    setDispatchNumber: orderflowStore.setDispatchNumber.bind(orderflowStore),
  };
}
