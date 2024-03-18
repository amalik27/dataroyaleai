const getOrderAmount = (credits_purchased) => {
    //calculates order total
    const exchange_rate = 20 // 20 credits for 1 dollar
    order = credits_purchased * exchange_rate;
    console.log(order)
    return order;
  };

module.exports = {
    getOrderAmount
}